export const STORAGE_KEY = "gitarrenunterricht_state_v3";

function createStudent(groupIndex, studentIndex, overrides = {}) {
  return {
    id: "student-" + groupIndex + "-" + (studentIndex + 1),
    name: "Schüler " + (studentIndex + 1),
    className: "Klasse " + ((studentIndex % 4) + 1) + " a",
    ...overrides
  };
}

export function createState(groupCount = 2, options = {}) {
  const {
    longContent = false,
    minRows = 3,
    studentsPerGroup = 2,
    term = "Schuljahr 2026/2027"
  } = options;
  const groups = Array.from({ length: groupCount }, (_, groupIndex) => ({
    id: "group-" + (groupIndex + 1),
    day: groupIndex % 2 ? "Dienstag" : "Montag",
    time: 15 + groupIndex + ":00 Uhr - fortlaufender Kurs",
    students: Array.from({ length: studentsPerGroup }, (_, studentIndex) => (
      createStudent(groupIndex, studentIndex, studentIndex === 0 ? {
        name: "Sehr langer Schülername mit mehreren Bestandteilen und zusätzlicher Bezeichnung"
      } : {})
    ))
  }));

  if (longContent && groups[0]) {
    groups[0].day = "Außergewöhnlich langer Wochentag mit sicherem Umbruch";
    groups[0].time = "Nachmittagskurs mit besonders langer Gruppenbezeichnung und zusätzlichen Angaben";
    groups[0].students = Array.from({ length: studentsPerGroup }, (_, studentIndex) => (
      createStudent(0, studentIndex, {
        name: "Sehr langer Schülername mit mehreren Bestandteilen und Zusatz Nummer " + (studentIndex + 1),
        className: "Ausführliche Klassenbezeichnung " + (studentIndex + 1)
      })
    ));
  }

  return {
    version: 3,
    revision: 7,
    updatedAt: "2026-09-04T08:00:00.000Z",
    activePlanId: "plan-1",
    minRows,
    plans: [{
      id: "plan-1",
      name: "Responsiver Testplan",
      meta: {
        title: longContent
          ? "Gitarrenunterricht mit einem sehr langen, sicher umbrechenden Dokumenttitel"
          : "Gitarrenunterricht mit einem langen Titel",
        teacher: longContent
          ? "Lehrkraft mit einem außergewöhnlich langen Namen für die Druckprüfung"
          : "Lehrkraft mit langem Namen",
        location: longContent
          ? "Musikraum im zweiten Obergeschoss mit ausführlicher Ortsbeschreibung"
          : "Musikraum im zweiten Obergeschoss",
        term
      },
      groups
    }]
  };
}

export function createFortyStudentState() {
  const state = createState(1, { studentsPerGroup: 40, minRows: 6 });
  state.plans[0].groups[0].students.forEach((item, index) => {
    item.name = "Schüler " + String(index + 1).padStart(2, "0");
  });
  return state;
}

export async function seedState(page, state) {
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: state });
}

export async function replaceState(page, state) {
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: state });
  await page.reload();
}
