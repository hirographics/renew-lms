// Renew Parts lab server. One program, one data folder.
// It serves the parts app and keeps the shared lab data (stock, pulls, returns, orders) in one SQLite file.
package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed app.html
var embeddedApp []byte

const serverVersion = "1.0.1"
const appSource = "https://hirographics.github.io/renew-lms/parts/"

var (
	db      *sql.DB
	dataDir string
	mu      sync.Mutex // one writer at a time; keeps stock counts exact
	hub     = &Hub{subs: map[chan []byte]string{}}
)

type Hub struct {
	sync.Mutex
	subs map[chan []byte]string
}

func (h *Hub) add(sid string) chan []byte {
	c := make(chan []byte, 256)
	h.Lock()
	h.subs[c] = sid
	h.Unlock()
	return c
}
func (h *Hub) remove(c chan []byte) { h.Lock(); delete(h.subs, c); h.Unlock() }
func (h *Hub) send(b []byte) {
	h.Lock()
	for c := range h.subs {
		select {
		case c <- b:
		default: // slow client: drop; it resyncs on reconnect
		}
	}
	h.Unlock()
}

type Op struct {
	O  string                 `json:"o"`           // client op id (makes retries safe)
	T  string                 `json:"t"`           // put | del | set | inc
	C  string                 `json:"c"`           // collection
	ID string                 `json:"id"`          // record id
	D  json.RawMessage        `json:"d,omitempty"` // put: whole record
	F  map[string]interface{} `json:"f,omitempty"` // set: fields to merge
	K  string                 `json:"k,omitempty"` // inc: field
	N  float64                `json:"n,omitempty"` // inc: amount
}

type Session struct {
	Token string
	Name  string
	Admin bool
	Sid   string
}

func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}

func openDB() {
	var err error
	db, err = sql.Open("sqlite", filepath.Join(dataDir, "parts.db")+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=synchronous(FULL)")
	must(err)
	db.SetMaxOpenConns(1)
	for _, q := range []string{
		`CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, name TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0, sid TEXT NOT NULL, created TEXT NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS docs(coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, ord INTEGER NOT NULL, PRIMARY KEY(coll,id))`,
		`CREATE TABLE IF NOT EXISTS ops(seq INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, who TEXT NOT NULL, sid TEXT NOT NULL, opid TEXT NOT NULL UNIQUE, op TEXT NOT NULL)`,
	} {
		_, err = db.Exec(q)
		must(err)
	}
}

func metaGet(k string) string {
	var v string
	db.QueryRow(`SELECT v FROM meta WHERE k=?`, k).Scan(&v)
	return v
}
func metaSet(k, v string) {
	db.Exec(`INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`, k, v)
}

func randHex(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}
func hashSecret(secret, salt string) string {
	h := []byte(salt + ":" + secret)
	for i := 0; i < 50000; i++ {
		s := sha256.Sum256(h)
		h = s[:]
	}
	return hex.EncodeToString(h)
}
func checkSecret(kind, given string) bool {
	salt, want := metaGet(kind+"_salt"), metaGet(kind+"_hash")
	if want == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(hashSecret(given, salt)), []byte(want)) == 1
}
func setSecret(kind, secret string) {
	salt := randHex(8)
	metaSet(kind+"_salt", salt)
	metaSet(kind+"_hash", hashSecret(secret, salt))
}

func people() []string {
	var p []string
	json.Unmarshal([]byte(metaGet("people")), &p)
	if p == nil {
		p = []string{}
	}
	return p
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]interface{}{"ok": false, "error": msg})
}

func auth(r *http.Request) *Session {
	t := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if t == "" {
		t = r.URL.Query().Get("token")
	}
	if t == "" {
		return nil
	}
	s := &Session{Token: t}
	var adm int
	if db.QueryRow(`SELECT name,admin,sid FROM sessions WHERE token=?`, t).Scan(&s.Name, &adm, &s.Sid) != nil {
		return nil
	}
	s.Admin = adm == 1
	return s
}

func lastSeq() int64 {
	var n sql.NullInt64
	db.QueryRow(`SELECT MAX(seq) FROM ops`).Scan(&n)
	return n.Int64
}

// applyOp changes one record inside the open transaction.
func applyOp(tx *sql.Tx, op *Op, seq int64) error {
	if op.C == "" || op.ID == "" {
		return fmt.Errorf("missing collection or id")
	}
	readDoc := func() (map[string]interface{}, bool) {
		var s string
		if tx.QueryRow(`SELECT data FROM docs WHERE coll=? AND id=?`, op.C, op.ID).Scan(&s) != nil {
			return map[string]interface{}{}, false
		}
		m := map[string]interface{}{}
		json.Unmarshal([]byte(s), &m)
		return m, true
	}
	writeDoc := func(m interface{}) error {
		b, _ := json.Marshal(m)
		_, err := tx.Exec(`INSERT INTO docs(coll,id,data,ord) VALUES(?,?,?,?) ON CONFLICT(coll,id) DO UPDATE SET data=excluded.data`, op.C, op.ID, string(b), seq)
		return err
	}
	switch op.T {
	case "put":
		if !json.Valid(op.D) {
			return fmt.Errorf("bad record")
		}
		_, err := tx.Exec(`INSERT INTO docs(coll,id,data,ord) VALUES(?,?,?,?) ON CONFLICT(coll,id) DO UPDATE SET data=excluded.data`, op.C, op.ID, string(op.D), seq)
		return err
	case "del":
		_, err := tx.Exec(`DELETE FROM docs WHERE coll=? AND id=?`, op.C, op.ID)
		return err
	case "set":
		m, _ := readDoc()
		for k, v := range op.F {
			m[k] = v
		}
		return writeDoc(m)
	case "inc":
		m, _ := readDoc()
		cur, _ := m[op.K].(float64)
		m[op.K] = cur + op.N
		return writeDoc(m)
	}
	return fmt.Errorf("unknown op type %q", op.T)
}

func handleOps(w http.ResponseWriter, r *http.Request) {
	s := auth(r)
	if s == nil {
		fail(w, 401, "sign in first")
		return
	}
	var body struct {
		Ops []Op `json:"ops"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 32<<20)).Decode(&body); err != nil {
		fail(w, 400, "bad request")
		return
	}
	mu.Lock()
	defer mu.Unlock()
	tx, err := db.Begin()
	if err != nil {
		fail(w, 500, "database busy")
		return
	}
	type out struct {
		Seq int64  `json:"seq"`
		Who string `json:"who"`
		Sid string `json:"sid"`
		Op  *Op    `json:"op"`
	}
	var sent []out
	applied := []string{}
	now := time.Now().UTC().Format(time.RFC3339)
	for i := range body.Ops {
		op := &body.Ops[i]
		if op.O == "" {
			tx.Rollback()
			fail(w, 400, "op without id")
			return
		}
		var n int
		tx.QueryRow(`SELECT COUNT(*) FROM ops WHERE opid=?`, op.O).Scan(&n)
		if n > 0 { // already saved by an earlier try
			applied = append(applied, op.O)
			continue
		}
		raw, _ := json.Marshal(op)
		res, err := tx.Exec(`INSERT INTO ops(ts,who,sid,opid,op) VALUES(?,?,?,?,?)`, now, s.Name, s.Sid, op.O, string(raw))
		if err != nil {
			tx.Rollback()
			fail(w, 500, "could not save")
			return
		}
		seq, _ := res.LastInsertId()
		if err := applyOp(tx, op, seq); err != nil {
			tx.Rollback()
			fail(w, 400, err.Error())
			return
		}
		applied = append(applied, op.O)
		sent = append(sent, out{seq, s.Name, s.Sid, op})
	}
	if err := tx.Commit(); err != nil {
		fail(w, 500, "could not save")
		return
	}
	for _, o := range sent {
		b, _ := json.Marshal(o)
		hub.send(b)
	}
	writeJSON(w, 200, map[string]interface{}{"ok": true, "seq": lastSeq(), "applied": applied})
}

func handleState(w http.ResponseWriter, r *http.Request) {
	s := auth(r)
	if s == nil {
		fail(w, 401, "sign in first")
		return
	}
	mu.Lock()
	defer mu.Unlock()
	rows, err := db.Query(`SELECT coll,id,data FROM docs ORDER BY ord, id`)
	if err != nil {
		fail(w, 500, "database error")
		return
	}
	defer rows.Close()
	docs := map[string][]map[string]json.RawMessage{}
	for rows.Next() {
		var c, id, d string
		rows.Scan(&c, &id, &d)
		idj, _ := json.Marshal(id)
		docs[c] = append(docs[c], map[string]json.RawMessage{"id": idj, "d": json.RawMessage(d)})
	}
	writeJSON(w, 200, map[string]interface{}{"ok": true, "seq": lastSeq(), "docs": docs, "name": s.Name, "admin": s.Admin, "sid": s.Sid, "people": people(), "seeded": metaGet("seeded") == "1"})
}

func handleEvents(w http.ResponseWriter, r *http.Request) {
	s := auth(r)
	if s == nil {
		fail(w, 401, "sign in first")
		return
	}
	fl, ok := w.(http.Flusher)
	if !ok {
		fail(w, 500, "no streaming")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Accel-Buffering", "no")
	c := hub.add(s.Sid)
	defer hub.remove(c)
	fmt.Fprintf(w, "event: hello\ndata: {\"seq\":%d}\n\n", lastSeq())
	fl.Flush()
	tick := time.NewTicker(20 * time.Second)
	defer tick.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case b := <-c:
			fmt.Fprintf(w, "data: %s\n\n", b)
			fl.Flush()
		case <-tick.C:
			fmt.Fprint(w, ": keep-alive\n\n")
			fl.Flush()
		}
	}
}

func readBody(r *http.Request, v interface{}) error {
	return json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(v)
}

func cleanPeople(in []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, p := range in {
		p = strings.TrimSpace(p)
		if p != "" && len(p) <= 40 && !seen[strings.ToLower(p)] {
			seen[strings.ToLower(p)] = true
			out = append(out, p)
		}
	}
	sort.Strings(out)
	return out
}

func appPath() string { return filepath.Join(dataDir, "app", "index.html") }
func appBytes() []byte {
	if b, err := os.ReadFile(appPath()); err == nil && len(b) > 100000 {
		return b
	}
	return embeddedApp
}

func updateApp() (int, error) {
	c := &http.Client{Timeout: 60 * time.Second}
	resp, err := c.Get(appSource + "?t=" + fmt.Sprint(time.Now().Unix()))
	if err != nil {
		return 0, fmt.Errorf("could not reach the update site")
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
	if err != nil || resp.StatusCode != 200 {
		return 0, fmt.Errorf("update site answered %d", resp.StatusCode)
	}
	if len(b) < 1000000 || !strings.Contains(string(b), "renew-parts-demo") || !strings.Contains(string(b), "liveBoot") {
		return 0, fmt.Errorf("the downloaded file does not look like the parts app; kept the current version")
	}
	os.MkdirAll(filepath.Dir(appPath()), 0o755)
	if old, err := os.ReadFile(appPath()); err == nil {
		os.WriteFile(filepath.Join(dataDir, "app", "index.previous.html"), old, 0o644)
	}
	tmp := appPath() + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return 0, err
	}
	return len(b), os.Rename(tmp, appPath())
}

func backup() {
	dir := filepath.Join(dataDir, "backups")
	os.MkdirAll(dir, 0o755)
	name := filepath.Join(dir, "parts-"+time.Now().Format("2006-01-02")+".db")
	os.Remove(name)
	mu.Lock()
	_, err := db.Exec(`VACUUM INTO ?`, name)
	mu.Unlock()
	if err != nil {
		log.Println("backup failed:", err)
		return
	}
	files, _ := filepath.Glob(filepath.Join(dir, "parts-*.db"))
	sort.Strings(files)
	for len(files) > 60 {
		os.Remove(files[0])
		files = files[1:]
	}
	log.Println("backup saved:", name)
}

func lanAddrs() []string {
	var out []string
	ifs, _ := net.Interfaces()
	for _, i := range ifs {
		if i.Flags&net.FlagUp == 0 || i.Flags&net.FlagLoopback != 0 {
			continue
		}
		as, _ := i.Addrs()
		for _, a := range as {
			if n, ok := a.(*net.IPNet); ok && n.IP.To4() != nil {
				out = append(out, n.IP.String())
			}
		}
	}
	return out
}

func main() {
	port := flag.Int("port", 8080, "port to listen on")
	flag.StringVar(&dataDir, "data", "renew-parts-data", "folder for the database, backups and app updates")
	resetSetup := flag.Bool("reset-setup", false, "forget the lab passcode and office PIN so the setup screen shows again; lab data is kept")
	flag.Parse()
	must(os.MkdirAll(dataDir, 0o755))
	openDB()
	if *resetSetup {
		db.Exec(`DELETE FROM meta WHERE k IN ('passcode_hash','passcode_salt','pin_hash','pin_salt')`)
		db.Exec(`DELETE FROM sessions`)
		fmt.Println("Passcode and office PIN are cleared. All devices are signed out. Lab data is kept.")
		fmt.Println("Start the server normally and open it: the setup screen shows again.")
		return
	}
	go func() {
		time.Sleep(30 * time.Second)
		for {
			backup()
			time.Sleep(24 * time.Hour)
		}
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/hello", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]interface{}{"ok": true, "renewParts": true, "server": serverVersion, "setup": metaGet("passcode_hash") != "", "people": people()})
	})
	mux.HandleFunc("/api/setup", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			fail(w, 405, "POST only")
			return
		}
		mu.Lock()
		defer mu.Unlock()
		if metaGet("passcode_hash") != "" {
			fail(w, 403, "already set up")
			return
		}
		var b struct {
			Passcode, Pin string
			People        []string
		}
		if readBody(r, &b) != nil || len(b.Passcode) < 4 || len(b.Pin) < 4 || len(cleanPeople(b.People)) == 0 {
			fail(w, 400, "need a passcode and an office PIN of 4 or more characters, and at least one name")
			return
		}
		if b.Passcode == b.Pin {
			fail(w, 400, "the office PIN must differ from the lab passcode")
			return
		}
		setSecret("passcode", b.Passcode)
		setSecret("pin", b.Pin)
		pj, _ := json.Marshal(cleanPeople(b.People))
		metaSet("people", string(pj))
		writeJSON(w, 200, map[string]interface{}{"ok": true})
	})
	mux.HandleFunc("/api/login", func(w http.ResponseWriter, r *http.Request) {
		var b struct{ Passcode, Name string }
		if r.Method != "POST" || readBody(r, &b) != nil {
			fail(w, 400, "bad request")
			return
		}
		if !checkSecret("passcode", b.Passcode) {
			time.Sleep(700 * time.Millisecond)
			fail(w, 403, "wrong passcode")
			return
		}
		okName := false
		for _, p := range people() {
			if p == b.Name {
				okName = true
			}
		}
		if !okName {
			fail(w, 400, "pick your name")
			return
		}
		tok := randHex(24)
		_, err := db.Exec(`INSERT INTO sessions(token,name,admin,sid,created) VALUES(?,?,0,?,?)`, tok, b.Name, randHex(6), time.Now().UTC().Format(time.RFC3339))
		if err != nil {
			fail(w, 500, "could not sign in")
			return
		}
		writeJSON(w, 200, map[string]interface{}{"ok": true, "token": tok})
	})
	mux.HandleFunc("/api/logout", func(w http.ResponseWriter, r *http.Request) {
		if s := auth(r); s != nil {
			db.Exec(`DELETE FROM sessions WHERE token=?`, s.Token)
		}
		writeJSON(w, 200, map[string]interface{}{"ok": true})
	})
	mux.HandleFunc("/api/admin", func(w http.ResponseWriter, r *http.Request) {
		s := auth(r)
		var b struct {
			Pin string
			Off bool
		}
		if s == nil || r.Method != "POST" || readBody(r, &b) != nil {
			fail(w, 401, "sign in first")
			return
		}
		if b.Off {
			db.Exec(`UPDATE sessions SET admin=0 WHERE token=?`, s.Token)
			writeJSON(w, 200, map[string]interface{}{"ok": true})
			return
		}
		if !checkSecret("pin", b.Pin) {
			time.Sleep(700 * time.Millisecond)
			fail(w, 403, "wrong PIN")
			return
		}
		db.Exec(`UPDATE sessions SET admin=1 WHERE token=?`, s.Token)
		writeJSON(w, 200, map[string]interface{}{"ok": true})
	})
	adminOnly := func(h func(http.ResponseWriter, *http.Request, *Session)) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			s := auth(r)
			if s == nil {
				fail(w, 401, "sign in first")
				return
			}
			if !s.Admin {
				fail(w, 403, "office PIN needed")
				return
			}
			h(w, r, s)
		}
	}
	mux.HandleFunc("/api/people", adminOnly(func(w http.ResponseWriter, r *http.Request, s *Session) {
		var b struct{ People []string }
		if r.Method != "POST" || readBody(r, &b) != nil || len(cleanPeople(b.People)) == 0 {
			fail(w, 400, "need at least one name")
			return
		}
		pj, _ := json.Marshal(cleanPeople(b.People))
		metaSet("people", string(pj))
		writeJSON(w, 200, map[string]interface{}{"ok": true, "people": cleanPeople(b.People)})
	}))
	mux.HandleFunc("/api/secrets", adminOnly(func(w http.ResponseWriter, r *http.Request, s *Session) {
		var b struct{ Passcode, Pin string }
		if r.Method != "POST" || readBody(r, &b) != nil {
			fail(w, 400, "bad request")
			return
		}
		if b.Passcode != "" {
			if len(b.Passcode) < 4 {
				fail(w, 400, "passcode too short")
				return
			}
			setSecret("passcode", b.Passcode)
		}
		if b.Pin != "" {
			if len(b.Pin) < 4 {
				fail(w, 400, "PIN too short")
				return
			}
			setSecret("pin", b.Pin)
		}
		writeJSON(w, 200, map[string]interface{}{"ok": true})
	}))
	mux.HandleFunc("/api/seeded", func(w http.ResponseWriter, r *http.Request) {
		if auth(r) == nil || r.Method != "POST" {
			fail(w, 401, "sign in first")
			return
		}
		metaSet("seeded", "1")
		writeJSON(w, 200, map[string]interface{}{"ok": true})
	})
	mux.HandleFunc("/api/update-app", adminOnly(func(w http.ResponseWriter, r *http.Request, s *Session) {
		n, err := updateApp()
		if err != nil {
			fail(w, 502, err.Error())
			return
		}
		writeJSON(w, 200, map[string]interface{}{"ok": true, "bytes": n})
	}))
	mux.HandleFunc("/api/export", adminOnly(func(w http.ResponseWriter, r *http.Request, s *Session) {
		mu.Lock()
		defer mu.Unlock()
		out := map[string]interface{}{"exported": time.Now().Format(time.RFC3339)}
		docs := []map[string]interface{}{}
		rows, _ := db.Query(`SELECT coll,id,data FROM docs ORDER BY coll,ord`)
		for rows.Next() {
			var c, id, d string
			rows.Scan(&c, &id, &d)
			docs = append(docs, map[string]interface{}{"coll": c, "id": id, "data": json.RawMessage(d)})
		}
		rows.Close()
		log_ := []map[string]interface{}{}
		rows, _ = db.Query(`SELECT seq,ts,who,op FROM ops ORDER BY seq`)
		for rows.Next() {
			var seq int64
			var ts, who, op string
			rows.Scan(&seq, &ts, &who, &op)
			log_ = append(log_, map[string]interface{}{"seq": seq, "ts": ts, "who": who, "op": json.RawMessage(op)})
		}
		rows.Close()
		out["records"] = docs
		out["history"] = log_
		w.Header().Set("Content-Disposition", `attachment; filename="renew-parts-export-`+time.Now().Format("2006-01-02")+`.json"`)
		writeJSON(w, 200, out)
	}))
	mux.HandleFunc("/api/state", handleState)
	mux.HandleFunc("/api/ops", handleOps)
	mux.HandleFunc("/api/events", handleEvents)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" && r.URL.Path != "/index.html" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		w.Write(appBytes())
	})

	addr := fmt.Sprintf(":%d", *port)
	fmt.Println("Renew Parts server", serverVersion)
	fmt.Println("Data folder:", dataDir)
	fmt.Printf("On this computer open:   http://localhost:%d\n", *port)
	for _, ip := range lanAddrs() {
		fmt.Printf("On phones and other PCs: http://%s:%d\n", ip, *port)
	}
	fmt.Println("Leave this window open. Close it to stop the server.")
	must(http.ListenAndServe(addr, mux))
}
