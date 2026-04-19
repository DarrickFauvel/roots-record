import { auth } from "../auth.js";
import { db } from "../db/client.js";
import { nanoid } from "nanoid";

const DEMO_EMAIL = "demo@rootsrecord.com";
const DEMO_PASSWORD = "demo1234";

export async function seedDemo(): Promise<void> {
  const existing = await db.execute({ sql: "SELECT id, username FROM user WHERE email = ?", args: [DEMO_EMAIL] });
  if (existing.rows.length > 0) {
    // Ensure username is set for already-seeded demo user
    if (!existing.rows[0].username) {
      await db.execute({ sql: "UPDATE user SET username = 'demo' WHERE email = ?", args: [DEMO_EMAIL] });
    }
    return;
  }

  // Create the demo user via Better Auth
  const result = await auth.api.signUpEmail({
    body: { name: "Demo User", email: DEMO_EMAIL, password: DEMO_PASSWORD, username: "demo" },
  });
  const uid = result.user.id;

  // ── People ────────────────────────────────────────────────────────────────
  const ids = {
    john:     nanoid(), mary:    nanoid(),
    william:  nanoid(), agnes:   nanoid(),
    elizabeth:nanoid(), george:  nanoid(),
    thomas:   nanoid(),
    robert:   nanoid(), dorothy: nanoid(),
    james:    nanoid(),
  };

  const people = [
    // Generation 1
    [ids.john,      "John",      "Henry",    "Smith",    null,      "M", "1845-03-12", "Nashville, TN",  "1920-11-04", "Louisville, KY",  null,         "Family patriarch. Civil War veteran, later a schoolteacher.", uid],
    [ids.mary,      "Mary",      "Elizabeth","Smith",    "Jones",   "F", "1850-07-22", "Richmond, VA",   "1928-02-14", "Louisville, KY",  null,         "Beloved matriarch. Known for her herb garden and letters.", uid],
    // Generation 2
    [ids.william,   "William",   "James",    "Smith",    null,      "M", "1872-05-18", "Louisville, KY", "1945-08-30", "Cincinnati, OH",  null,         null, uid],
    [ids.agnes,     "Agnes",     "Rose",     "Smith",    "Brown",   "F", "1874-09-03", "Lexington, KY",  "1952-01-17", "Cincinnati, OH",  null,         null, uid],
    [ids.elizabeth, "Elizabeth", "Ann",      "Wilson",   "Smith",   "F", "1875-12-01", "Louisville, KY", "1958-06-09", "Louisville, KY",  null,         null, uid],
    [ids.george,    "George",    "Edward",   "Wilson",   null,      "M", "1873-04-14", "Frankfort, KY",  "1940-03-28", "Louisville, KY",  null,         null, uid],
    [ids.thomas,    "Thomas",    "Robert",   "Smith",    null,      "M", "1879-02-27", "Louisville, KY", "1951-10-11", "Indianapolis, IN",null,         null, uid],
    // Generation 3
    [ids.robert,    "Robert",    "Henry",    "Smith",    null,      "M", "1900-06-15", "Cincinnati, OH", "1978-09-02", "Columbus, OH",    null,         null, uid],
    [ids.dorothy,   "Dorothy",   "Mae",      "Smith",    null,      "F", "1903-11-28", "Cincinnati, OH", "1987-04-19", "Cincinnati, OH",  null,         null, uid],
    [ids.james,     "James",     "Thomas",   "Smith",    null,      "M", "1908-08-07", "Indianapolis, IN","1992-12-31","Indianapolis, IN",null,         null, uid],
  ];

  for (const p of people) {
    await db.execute({
      sql: `INSERT INTO people (id, given_name, middle_name, surname, maiden_name, sex, birth_date, birth_place, death_date, death_place, death_cause, notes, created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: p,
    });
  }

  // ── Relationships ─────────────────────────────────────────────────────────
  const rels: Array<[string, string, string, string | null]> = [
    // Spouses (gen 1)
    [ids.john,      ids.mary,      "spouse",       "1869-06-10"],
    // Children of John & Mary
    [ids.john,      ids.william,   "parent_child", null],
    [ids.mary,      ids.william,   "parent_child", null],
    [ids.john,      ids.elizabeth, "parent_child", null],
    [ids.mary,      ids.elizabeth, "parent_child", null],
    [ids.john,      ids.thomas,    "parent_child", null],
    [ids.mary,      ids.thomas,    "parent_child", null],
    // Spouses (gen 2)
    [ids.william,   ids.agnes,     "spouse",       "1896-04-22"],
    [ids.elizabeth, ids.george,    "spouse",       "1897-09-15"],
    // Children of William & Agnes
    [ids.william,   ids.robert,    "parent_child", null],
    [ids.agnes,     ids.robert,    "parent_child", null],
    [ids.william,   ids.dorothy,   "parent_child", null],
    [ids.agnes,     ids.dorothy,   "parent_child", null],
    // Children of Thomas
    [ids.thomas,    ids.james,     "parent_child", null],
  ];

  for (const [p1, p2, type, start] of rels) {
    await db.execute({
      sql: "INSERT INTO relationships (id, person1_id, person2_id, type, start_date) VALUES (?,?,?,?,?)",
      args: [nanoid(), p1, p2, type, start],
    });
  }

  // ── Residences ────────────────────────────────────────────────────────────
  const residences: Array<[string, string, string, string | null, string | null]> = [
    [ids.john,    "Nashville, TN",     "residence",   "1845", "1867"],
    [ids.john,    "Louisville, KY",    "residence",   "1867", null],
    [ids.mary,    "Richmond, VA",      "residence",   "1850", "1869"],
    [ids.mary,    "Louisville, KY",    "residence",   "1869", null],
    [ids.william, "Louisville, KY",    "residence",   "1872", "1895"],
    [ids.william, "Cincinnati, OH",    "residence",   "1895", null],
    [ids.thomas,  "Louisville, KY",    "residence",   "1879", "1902"],
    [ids.thomas,  "Indianapolis, IN",  "immigration", "1902", null],
  ];

  for (const [personId, place, type, start, end] of residences) {
    await db.execute({
      sql: "INSERT INTO residences (id, person_id, place, start_date, end_date, type) VALUES (?,?,?,?,?,?)",
      args: [nanoid(), personId, place, start, end, type],
    });
  }

  console.log("Demo account seeded (demo@rootsrecord.com / demo1234)");
}
