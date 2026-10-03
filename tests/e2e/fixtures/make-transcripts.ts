// Generates the three fixture transcript PDFs used by the student e2e test:
//   npx tsx tests/e2e/fixtures/make-transcripts.ts
// Synthetic people and grades; course titles match the seeded catalog.
import { chromium } from '@playwright/test'

const FIXTURES = [
  {
    file: 'uw-computer-engineering.pdf',
    school: 'University of Waterloo',
    name: 'Avery Lindqvist',
    program: 'Computer Engineering (BASc), expected 2027',
    terms: [
      ['Fall 2023', [['ENGG 105', 'Calculus I', 'A'], ['ENGG 112', 'Introduction to Programming', 'A'], ['ENGG 118', 'Linear Algebra for Engineers', 'B']]],
      ['Fall 2024', [['ECE 205', 'Digital Logic Design', 'A'], ['ECE 214', 'Microprocessor Systems', 'A'], ['ECE 222', 'Signals and Systems', 'B']]],
      ['Fall 2025', [['ECE 305', 'Embedded Real-Time Systems', 'A'], ['ECE 318', 'Computer Architecture', 'B'], ['ME 410', 'Mechatronic System Design', 'A']]],
    ],
  },
  {
    file: 'uoft-computer-science.pdf',
    school: 'University of Toronto',
    name: 'Rohan Mehta-Okafor',
    program: 'Computer Science, Specialist, expected 2026',
    terms: [
      ['Fall 2022', [['CSC 108', 'Introduction to Programming', 'A'], ['STA 207', 'Probability', 'B']]],
      ['Winter 2024', [['CSC 263', 'Data Structures and Algorithms', 'A'], ['CSC 343', 'Database Systems', 'A']]],
      ['Fall 2025', [['CSC 311', 'Machine Learning', 'A'], ['CSC 413', 'Deep Learning', 'IP']]],
    ],
  },
  {
    file: 'mac-mechanical.pdf',
    school: 'McMaster University',
    name: 'Léa Tremblay-Nakamura',
    program: 'Mechanical Engineering, expected 2028',
    terms: [
      ['Fall 2024', [['MECHENG 110', 'Statics', 'A'], ['ENGINEER 103', 'Calculus II', 'B']]],
      ['Winter 2025', [['MECHENG 205', 'Thermodynamics', 'B'], ['MECHENG 216', 'Fluid Mechanics', 'C']]],
      ['Fall 2025', [['MECHENG 302', 'Machine Design', 'A'], ['MECHENG 213', 'Computer-Aided Design', 'P']]],
    ],
  },
] as const

const browser = await chromium.launch()
const page = await browser.newPage()
for (const f of FIXTURES) {
  const rows = f.terms
    .map(([term, courses]) => `<h3>${term}</h3><table>${courses.map(([c, t, g]) => `<tr><td>${c}</td><td>${t}</td><td>0.50</td><td>${g}</td></tr>`).join('')}</table>`)
    .join('')
  await page.setContent(`<html><body style="font-family:Helvetica;font-size:12px;padding:40px">
    <h1 style="font-size:18px">${f.school}: Unofficial Transcript</h1>
    <p>Student: ${f.name}<br/>Program: ${f.program}</p>${rows}
    <style>table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #ccc;padding:4px}</style></body></html>`)
  await page.pdf({ path: `tests/e2e/fixtures/${f.file}`, format: 'Letter' })
  console.log(`wrote tests/e2e/fixtures/${f.file}`)
}
await browser.close()
