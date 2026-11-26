// Crea (o reinicia) la agenda de ejemplo en Firestore para los próximos 14 días.
// OJO: volver a correrlo vuelve a dejar libres las horas ya reservadas.
import dotenv from 'dotenv';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config();
initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const ESPECIALIDADES: [string, string][] = [
  ['Medicina general', 'Dra. Valdés'],
  ['Pediatría', 'Dr. Rojas'],
  ['Dermatología', 'Dra. Pizarro'],
  ['Ginecología', 'Dra. Soto'],
];
const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, '-');
const HORAS: string[] = [];
for (let h = 9; h < 17; h++) HORAS.push(`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`);

async function main() {
  const batch = db.batch();
  let n = 0;
  for (let i = 0; i < 14; i++) {
    const fecha = new Date(Date.now() + i * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    const dia = new Date(fecha + 'T12:00:00').getDay();
    if (dia === 0 || dia === 6) continue; // sin fines de semana
    for (const [especialidad, profesional] of ESPECIALIDADES) {
      const horas = HORAS.filter(() => Math.random() < 0.35); // ~5 horas libres por día
      batch.set(db.collection('agenda').doc(`${norm(especialidad)}_${fecha}`), { especialidad, profesional, fecha, horas });
      n++;
    }
  }
  await batch.commit();
  console.log(`Agenda creada: ${n} días-especialidad.`);
}
main().catch((e) => { console.error(e?.message || e); process.exit(1); });
