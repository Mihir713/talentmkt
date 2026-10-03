// Synthetic but plausible catalog: universities, programs and course concepts. Each university
// instantiates the concepts for the disciplines it teaches under its own department codes.

export type Discipline = 'gen' | 'ece' | 'cs' | 'mech' | 'civil' | 'chem' | 'stat' | 'bus' | 'bme' | 'phys'

export interface UniversitySpec {
  name: string
  short: string
  domain: string
  weight: number
  depts: Record<Discipline, string>
  programs: ProgramKey[]
}

export const UNIVERSITIES: UniversitySpec[] = [
  {
    name: 'University of Waterloo', short: 'UW', domain: 'uwaterloo.ca', weight: 1.4,
    depts: { gen: 'ENGG', ece: 'ECE', cs: 'CS', mech: 'ME', civil: 'CIVE', chem: 'CHE', stat: 'STAT', bus: 'AFM', bme: 'BME', phys: 'PHYS' },
    programs: ['compeng', 'eleceng', 'softeng', 'cs', 'mecheng', 'mtecheng', 'civeng', 'chemeng', 'bmeng', 'stats', 'mathfin', 'sysdesign'],
  },
  {
    name: 'University of Toronto', short: 'UofT', domain: 'utoronto.ca', weight: 1.4,
    depts: { gen: 'APS', ece: 'ECE', cs: 'CSC', mech: 'MIE', civil: 'CIV', chem: 'CHE', stat: 'STA', bus: 'RSM', bme: 'BME', phys: 'PHY' },
    programs: ['compeng', 'eleceng', 'cs', 'mecheng', 'civeng', 'chemeng', 'enggsci', 'stats', 'mathfin', 'bmeng'],
  },
  {
    name: 'McMaster University', short: 'Mac', domain: 'mcmaster.ca', weight: 1.0,
    depts: { gen: 'ENGINEER', ece: 'ELECENG', cs: 'COMPSCI', mech: 'MECHENG', civil: 'CIVENG', chem: 'CHEMENG', stat: 'STATS', bus: 'COMMERCE', bme: 'BIOMEDE', phys: 'PHYSICS' },
    programs: ['compeng', 'eleceng', 'softeng', 'cs', 'mecheng', 'mtecheng', 'civeng', 'chemeng', 'bmeng'],
  },
  {
    name: "Queen's University", short: 'Queens', domain: 'queensu.ca', weight: 0.8,
    depts: { gen: 'APSC', ece: 'ELEC', cs: 'CISC', mech: 'MECH', civil: 'CIVL', chem: 'CHEE', stat: 'STAT', bus: 'COMM', bme: 'BMED', phys: 'PHYS' },
    programs: ['compeng', 'eleceng', 'cs', 'mecheng', 'civeng', 'chemeng', 'stats', 'mathfin'],
  },
  {
    name: 'Western University', short: 'Western', domain: 'uwo.ca', weight: 0.8,
    depts: { gen: 'ENGSCI', ece: 'ECE', cs: 'CS', mech: 'MME', civil: 'CEE', chem: 'CBE', stat: 'STATS', bus: 'BUS', bme: 'BME', phys: 'PHYSICS' },
    programs: ['compeng', 'eleceng', 'softeng', 'cs', 'mecheng', 'civeng', 'chemeng', 'bmeng'],
  },
  {
    name: 'Toronto Metropolitan University', short: 'TMU', domain: 'torontomu.ca', weight: 0.9,
    depts: { gen: 'ENG', ece: 'ELE', cs: 'CPS', mech: 'MEC', civil: 'CVL', chem: 'CHE', stat: 'MTH', bus: 'FIN', bme: 'BME', phys: 'PCS' },
    programs: ['compeng', 'eleceng', 'cs', 'mecheng', 'aero', 'civeng', 'chemeng', 'bmeng'],
  },
]

export interface Concept {
  key: string
  disc: Discipline
  level: number
  title: string
  tags: [string, number][]
}

// [key, discipline, year level, title, "tag:weight tag:weight"]
const RAW: [string, Discipline, number, string, string][] = [
  // First year, everyone
  ['calc1', 'gen', 1, 'Calculus I', 'applied-math:0.6'],
  ['calc2', 'gen', 1, 'Calculus II', 'applied-math:0.6'],
  ['linalg', 'gen', 1, 'Linear Algebra for Engineers', 'applied-math:0.7'],
  ['mechanics', 'gen', 1, 'Physics: Mechanics', 'physics:0.8 solid-mechanics:0.2'],
  ['em1', 'gen', 1, 'Electricity and Magnetism', 'physics:0.6 rf-analog:0.2'],
  ['chem1', 'gen', 1, 'Chemistry for Engineers', 'materials:0.3 process-engineering:0.3'],
  ['prog1', 'gen', 1, 'Introduction to Programming', 'software-engineering:0.8 algorithms:0.2'],
  ['design1', 'gen', 1, 'Engineering Design and Communication', 'cad-mechanical:0.4 product-management:0.2'],
  // Electrical & computer
  ['digital', 'ece', 2, 'Digital Logic Design', 'vlsi-digital:0.8 computer-architecture:0.3'],
  ['circuits', 'ece', 2, 'Circuit Analysis', 'rf-analog:0.6 power-electronics:0.2'],
  ['devices', 'ece', 2, 'Electronic Devices', 'rf-analog:0.7 materials:0.2'],
  ['signals', 'ece', 2, 'Signals and Systems', 'signal-processing:0.8 control-systems:0.3'],
  ['micro', 'ece', 2, 'Microprocessor Systems', 'embedded-systems:0.9 computer-architecture:0.5'],
  ['embedded', 'ece', 3, 'Embedded Real-Time Systems', 'embedded-systems:1 operating-systems:0.4'],
  ['arch', 'ece', 3, 'Computer Architecture', 'computer-architecture:1 vlsi-digital:0.3'],
  ['analogic', 'ece', 4, 'Analog Integrated Circuits', 'rf-analog:1 vlsi-digital:0.3'],
  ['rf', 'ece', 4, 'RF Circuit Design', 'rf-analog:1 communications:0.4'],
  ['emwaves', 'ece', 3, 'Electromagnetic Waves', 'rf-analog:0.6 photonics:0.4 physics:0.4'],
  ['dsp', 'ece', 3, 'Digital Signal Processing', 'signal-processing:1'],
  ['comms', 'ece', 3, 'Communication Systems', 'communications:1 signal-processing:0.4'],
  ['wireless', 'ece', 4, 'Wireless Networks', 'communications:0.7 networking:0.6'],
  ['controls', 'ece', 3, 'Control Systems', 'control-systems:1'],
  ['digcontrol', 'ece', 4, 'Digital Control', 'control-systems:0.8 embedded-systems:0.3'],
  ['powersys', 'ece', 3, 'Power Systems Analysis', 'power-systems:1'],
  ['powerelec', 'ece', 4, 'Power Electronics', 'power-electronics:1 power-systems:0.3'],
  ['machines', 'ece', 3, 'Electric Machines and Drives', 'power-systems:0.6 power-electronics:0.4'],
  ['vlsi', 'ece', 4, 'VLSI Design', 'vlsi-digital:1'],
  ['fpga', 'ece', 4, 'FPGA-Based System Design', 'vlsi-digital:0.8 embedded-systems:0.5'],
  ['photonics', 'ece', 4, 'Photonic Devices', 'photonics:1'],
  ['semis', 'ece', 3, 'Semiconductor Physics', 'materials:0.5 vlsi-digital:0.4 physics:0.4'],
  ['imageproc', 'ece', 4, 'Image Processing', 'computer-vision:0.6 signal-processing:0.6'],
  ['iot', 'ece', 4, 'Internet of Things Systems', 'embedded-systems:0.7 networking:0.5'],
  ['hwsec', 'ece', 4, 'Hardware Security', 'security:0.7 vlsi-digital:0.4'],
  ['quantumcomp', 'ece', 4, 'Quantum Computing', 'quantum:1 physics:0.4'],
  ['renewables', 'ece', 4, 'Renewable Energy Systems', 'power-systems:0.8 power-electronics:0.4 environmental:0.2'],
  // Computing
  ['dsa', 'cs', 2, 'Data Structures and Algorithms', 'algorithms:1 software-engineering:0.4'],
  ['algdesign', 'cs', 3, 'Algorithm Design and Analysis', 'algorithms:1'],
  ['oodesign', 'cs', 2, 'Object-Oriented Software Design', 'software-engineering:1'],
  ['testing', 'cs', 3, 'Software Testing and Quality', 'software-engineering:0.9'],
  ['sysprog', 'cs', 2, 'Systems Programming', 'systems-programming:1 operating-systems:0.3'],
  ['os', 'cs', 3, 'Operating Systems', 'operating-systems:1 systems-programming:0.6'],
  ['concurrency', 'cs', 3, 'Concurrent and Parallel Programming', 'distributed-systems:0.5 systems-programming:0.6'],
  ['distsys', 'cs', 4, 'Distributed Systems', 'distributed-systems:1 cloud-infrastructure:0.4'],
  ['databases', 'cs', 3, 'Database Systems', 'databases:1'],
  ['dbinternals', 'cs', 4, 'Database Systems Implementation', 'databases:0.9 systems-programming:0.4'],
  ['bigdata', 'cs', 4, 'Data-Intensive Distributed Computing', 'data-engineering:0.9 distributed-systems:0.5'],
  ['networks', 'cs', 3, 'Computer Networks', 'networking:1'],
  ['security', 'cs', 3, 'Computer Security', 'security:1'],
  ['crypto', 'cs', 4, 'Applied Cryptography', 'security:0.8 applied-math:0.4'],
  ['compilers', 'cs', 4, 'Compiler Construction', 'compilers:1'],
  ['proglang', 'cs', 3, 'Programming Languages', 'compilers:0.7 software-engineering:0.3'],
  ['webdev', 'cs', 3, 'Web Application Development', 'web-development:1 hci:0.3'],
  ['mobile', 'cs', 4, 'Mobile Application Development', 'mobile-development:1 hci:0.2'],
  ['cloud', 'cs', 4, 'Cloud Computing', 'cloud-infrastructure:1 distributed-systems:0.5'],
  ['hci', 'cs', 3, 'Human-Computer Interaction', 'hci:1'],
  ['graphics', 'cs', 4, 'Computer Graphics', 'computer-graphics:1 applied-math:0.3'],
  ['introai', 'cs', 3, 'Introduction to Artificial Intelligence', 'ml:0.6 algorithms:0.3'],
  ['ml', 'cs', 3, 'Machine Learning', 'ml:1 statistics:0.4'],
  ['dl', 'cs', 4, 'Deep Learning', 'deep-learning:1 ml:0.6'],
  ['cv', 'cs', 4, 'Computer Vision', 'computer-vision:1 deep-learning:0.4'],
  ['nlp', 'cs', 4, 'Natural Language Processing', 'nlp:1 deep-learning:0.4 ml:0.3'],
  ['rl', 'cs', 4, 'Reinforcement Learning', 'ml:0.8 optimization:0.4'],
  ['dataeng', 'cs', 4, 'Data Engineering and Pipelines', 'data-engineering:1 databases:0.4'],
  ['ir', 'cs', 4, 'Information Retrieval', 'nlp:0.5 data-engineering:0.4'],
  ['softarch', 'cs', 4, 'Software Architecture', 'software-engineering:0.8 distributed-systems:0.3'],
  ['theory', 'cs', 3, 'Theory of Computation', 'algorithms:0.6 applied-math:0.4'],
  ['mlsys', 'cs', 4, 'Machine Learning Systems', 'ml:0.6 cloud-infrastructure:0.5 distributed-systems:0.4'],
  // Mechanical & aerospace
  ['statics', 'mech', 1, 'Statics', 'solid-mechanics:0.7'],
  ['dynamics', 'mech', 2, 'Dynamics', 'solid-mechanics:0.5 robotics:0.2'],
  ['mom', 'mech', 2, 'Mechanics of Materials', 'solid-mechanics:1'],
  ['thermo', 'mech', 2, 'Thermodynamics', 'thermofluids:1'],
  ['fluids', 'mech', 2, 'Fluid Mechanics', 'thermofluids:1'],
  ['heat', 'mech', 3, 'Heat Transfer', 'thermofluids:0.9'],
  ['machdesign', 'mech', 3, 'Machine Design', 'cad-mechanical:1 solid-mechanics:0.4'],
  ['cad', 'mech', 2, 'Computer-Aided Design', 'cad-mechanical:1'],
  ['fea', 'mech', 4, 'Finite Element Analysis', 'solid-mechanics:0.7 cad-mechanical:0.4 applied-math:0.3'],
  ['mfg', 'mech', 3, 'Manufacturing Processes', 'manufacturing:1'],
  ['mtedesign', 'mech', 4, 'Mechatronic System Design', 'mechatronics:1 embedded-systems:0.4 control-systems:0.3'],
  ['kinematics', 'mech', 3, 'Robot Kinematics and Dynamics', 'robotics:1 control-systems:0.3'],
  ['autonomy', 'mech', 4, 'Autonomous Mobile Robots', 'robotics:0.8 computer-vision:0.3 ml:0.3'],
  ['sensors', 'mech', 3, 'Sensors and Actuators', 'mechatronics:0.8 embedded-systems:0.3'],
  ['aerodynamics', 'mech', 3, 'Aerodynamics', 'aerospace:1 thermofluids:0.5'],
  ['aerostructures', 'mech', 4, 'Aircraft Structures', 'aerospace:0.8 solid-mechanics:0.5'],
  ['propulsion', 'mech', 4, 'Propulsion Systems', 'aerospace:0.8 thermofluids:0.6'],
  ['vibrations', 'mech', 3, 'Mechanical Vibrations', 'solid-mechanics:0.6 control-systems:0.3'],
  ['matselect', 'mech', 3, 'Materials Selection in Design', 'materials:0.8'],
  ['additive', 'mech', 4, 'Additive Manufacturing', 'manufacturing:0.9 cad-mechanical:0.4'],
  // Civil & environmental
  ['structanalysis', 'civil', 3, 'Structural Analysis', 'structural:1'],
  ['steel', 'civil', 4, 'Steel Design', 'structural:1'],
  ['concrete', 'civil', 4, 'Reinforced Concrete Design', 'structural:1 materials:0.3'],
  ['soils', 'civil', 3, 'Soil Mechanics', 'geotechnical:1'],
  ['foundations', 'civil', 4, 'Foundation Engineering', 'geotechnical:1 structural:0.3'],
  ['transport', 'civil', 3, 'Transportation Engineering', 'transportation:1'],
  ['traffic', 'civil', 4, 'Traffic Systems Analysis', 'transportation:0.9 optimization:0.2'],
  ['hydraulics', 'civil', 3, 'Hydraulics', 'water-resources:1 thermofluids:0.4'],
  ['waterres', 'civil', 4, 'Water Resources Engineering', 'water-resources:1'],
  ['enviro', 'civil', 3, 'Environmental Engineering', 'environmental:1'],
  ['wastewater', 'civil', 4, 'Water and Wastewater Treatment', 'environmental:0.8 process-engineering:0.4'],
  ['construction', 'civil', 4, 'Construction Management', 'operations-research:0.4 product-management:0.4'],
  // Chemical, materials, bio
  ['processprin', 'chem', 2, 'Chemical Process Principles', 'process-engineering:1'],
  ['reaction', 'chem', 3, 'Chemical Reaction Engineering', 'process-engineering:1'],
  ['separations', 'chem', 3, 'Separation Processes', 'process-engineering:0.9'],
  ['processcontrol', 'chem', 4, 'Process Dynamics and Control', 'process-engineering:0.6 control-systems:0.7'],
  ['processdesign', 'chem', 4, 'Chemical Plant Design', 'process-engineering:0.9 optimization:0.3'],
  ['polymers', 'chem', 4, 'Polymer Engineering', 'materials:0.8 process-engineering:0.4'],
  ['electrochem', 'chem', 4, 'Electrochemical Engineering and Batteries', 'materials:0.5 process-engineering:0.5 power-systems:0.2'],
  ['bioprocess', 'chem', 4, 'Bioprocess Engineering', 'biotech:0.9 process-engineering:0.5'],
  ['matsci', 'chem', 2, 'Materials Science', 'materials:1'],
  ['nanomat', 'chem', 4, 'Nanomaterials', 'materials:0.8 physics:0.3'],
  // Statistics & math
  ['probability', 'stat', 2, 'Probability', 'statistics:0.8 applied-math:0.4'],
  ['inference', 'stat', 2, 'Statistical Inference', 'statistics:1'],
  ['regression', 'stat', 3, 'Regression Analysis', 'statistics:1 ml:0.2'],
  ['timeseries', 'stat', 4, 'Time Series Analysis', 'statistics:0.8 quant-finance:0.3'],
  ['numerical', 'stat', 2, 'Numerical Methods', 'applied-math:1'],
  ['optim', 'stat', 3, 'Optimization', 'optimization:1 applied-math:0.4'],
  ['linprog', 'stat', 3, 'Linear Programming', 'operations-research:0.9 optimization:0.7'],
  ['stochastic', 'stat', 3, 'Stochastic Processes', 'statistics:0.6 quant-finance:0.5'],
  ['bayes', 'stat', 4, 'Bayesian Statistics', 'statistics:0.9 ml:0.3'],
  ['statlearn', 'stat', 4, 'Statistical Learning', 'ml:0.8 statistics:0.6'],
  // Business & finance
  ['engecon', 'bus', 2, 'Engineering Economics', 'economics:0.8'],
  ['microecon', 'bus', 1, 'Microeconomics', 'economics:1'],
  ['corpfin', 'bus', 2, 'Corporate Finance', 'quant-finance:0.5 economics:0.5'],
  ['derivatives', 'bus', 3, 'Financial Derivatives', 'quant-finance:1'],
  ['portfolio', 'bus', 4, 'Portfolio Theory and Risk', 'quant-finance:0.9 optimization:0.3'],
  ['stochcalc', 'bus', 4, 'Stochastic Calculus for Finance', 'quant-finance:1 applied-math:0.4'],
  ['pm', 'bus', 3, 'Technical Product Management', 'product-management:1'],
  ['entrepreneurship', 'bus', 4, 'Technology Entrepreneurship', 'product-management:0.7 economics:0.3'],
  ['opsmgmt', 'bus', 3, 'Operations Management', 'operations-research:0.8'],
  ['supplychain', 'bus', 4, 'Supply Chain Analytics', 'operations-research:0.8 optimization:0.3'],
  // Biomedical
  ['physiology', 'bme', 2, 'Physiology for Engineers', 'biomedical:0.8'],
  ['bioinstrument', 'bme', 3, 'Biomedical Instrumentation', 'biomedical:1 embedded-systems:0.3 rf-analog:0.3'],
  ['biomechanics', 'bme', 3, 'Biomechanics', 'biomedical:0.7 solid-mechanics:0.5'],
  ['biomaterials', 'bme', 4, 'Biomaterials', 'biomedical:0.6 materials:0.6'],
  ['medimaging', 'bme', 4, 'Medical Imaging', 'biomedical:0.7 computer-vision:0.4 signal-processing:0.4'],
  ['cellbio', 'bme', 2, 'Cell and Molecular Biology', 'biotech:1'],
  // Physics
  ['modernphys', 'phys', 2, 'Modern Physics', 'physics:1'],
  ['qm', 'phys', 3, 'Quantum Mechanics', 'physics:0.8 quantum:0.6'],
  ['optics', 'phys', 3, 'Optics', 'photonics:0.8 physics:0.5'],
]

export const CONCEPTS: Concept[] = RAW.map(([key, disc, level, title, tags]) => ({
  key,
  disc,
  level,
  title,
  tags: tags.split(' ').map((t) => {
    const [slug, w] = t.split(':')
    return [slug as string, Number(w)]
  }),
}))

export type ProgramKey =
  | 'compeng' | 'eleceng' | 'softeng' | 'cs' | 'mecheng' | 'mtecheng' | 'civeng' | 'chemeng'
  | 'bmeng' | 'stats' | 'mathfin' | 'enggsci' | 'aero' | 'sysdesign'

export interface ProgramSpec {
  name: string
  faculty: string
  weight: number
  core: string[]
  electives: Discipline[]
}

const ENG_Y1 = ['calc1', 'calc2', 'linalg', 'mechanics', 'em1', 'chem1', 'prog1', 'design1']

export const PROGRAMS: Record<ProgramKey, ProgramSpec> = {
  compeng: {
    name: 'Computer Engineering', faculty: 'Engineering', weight: 1.2, electives: ['ece', 'cs'],
    core: [...ENG_Y1, 'digital', 'circuits', 'dsa', 'micro', 'signals', 'sysprog', 'arch', 'os', 'embedded', 'networks'],
  },
  eleceng: {
    name: 'Electrical Engineering', faculty: 'Engineering', weight: 0.9, electives: ['ece', 'phys'],
    core: [...ENG_Y1, 'circuits', 'devices', 'digital', 'signals', 'emwaves', 'controls', 'powersys', 'comms', 'dsp', 'semis'],
  },
  softeng: {
    name: 'Software Engineering', faculty: 'Engineering', weight: 1.0, electives: ['cs', 'stat'],
    core: [...ENG_Y1, 'dsa', 'oodesign', 'sysprog', 'digital', 'testing', 'databases', 'os', 'networks', 'softarch', 'hci'],
  },
  cs: {
    name: 'Computer Science', faculty: 'Mathematics', weight: 1.5, electives: ['cs', 'stat'],
    core: ['calc1', 'linalg', 'prog1', 'microecon', 'probability', 'dsa', 'sysprog', 'oodesign', 'algdesign', 'theory', 'databases', 'os', 'proglang', 'introai'],
  },
  mecheng: {
    name: 'Mechanical Engineering', faculty: 'Engineering', weight: 1.1, electives: ['mech', 'chem'],
    core: [...ENG_Y1, 'statics', 'dynamics', 'mom', 'thermo', 'fluids', 'cad', 'heat', 'machdesign', 'mfg', 'vibrations'],
  },
  mtecheng: {
    name: 'Mechatronics Engineering', faculty: 'Engineering', weight: 0.6, electives: ['mech', 'ece', 'cs'],
    core: [...ENG_Y1, 'statics', 'dynamics', 'circuits', 'digital', 'micro', 'controls', 'sensors', 'kinematics', 'mtedesign', 'machdesign'],
  },
  civeng: {
    name: 'Civil Engineering', faculty: 'Engineering', weight: 0.9, electives: ['civil', 'mech'],
    core: [...ENG_Y1, 'statics', 'mom', 'fluids', 'structanalysis', 'soils', 'hydraulics', 'transport', 'enviro', 'steel', 'concrete'],
  },
  chemeng: {
    name: 'Chemical Engineering', faculty: 'Engineering', weight: 0.7, electives: ['chem', 'bme'],
    core: [...ENG_Y1, 'processprin', 'thermo', 'fluids', 'matsci', 'heat', 'reaction', 'separations', 'processcontrol', 'processdesign'],
  },
  bmeng: {
    name: 'Biomedical Engineering', faculty: 'Engineering', weight: 0.5, electives: ['bme', 'ece', 'chem'],
    core: [...ENG_Y1, 'cellbio', 'physiology', 'circuits', 'signals', 'bioinstrument', 'biomechanics', 'biomaterials', 'medimaging'],
  },
  stats: {
    name: 'Statistics and Data Science', faculty: 'Mathematics', weight: 0.6, electives: ['stat', 'cs'],
    core: ['calc1', 'calc2', 'linalg', 'prog1', 'probability', 'inference', 'numerical', 'dsa', 'regression', 'databases', 'statlearn', 'timeseries', 'bayes'],
  },
  mathfin: {
    name: 'Mathematical Finance', faculty: 'Mathematics', weight: 0.4, electives: ['stat', 'bus'],
    core: ['calc1', 'calc2', 'linalg', 'microecon', 'probability', 'inference', 'corpfin', 'numerical', 'stochastic', 'derivatives', 'portfolio', 'stochcalc'],
  },
  enggsci: {
    name: 'Engineering Science', faculty: 'Engineering', weight: 0.5, electives: ['cs', 'ece', 'phys', 'stat'],
    core: [...ENG_Y1, 'modernphys', 'numerical', 'signals', 'probability', 'qm', 'controls', 'ml', 'optim'],
  },
  aero: {
    name: 'Aerospace Engineering', faculty: 'Engineering', weight: 0.4, electives: ['mech', 'ece'],
    core: [...ENG_Y1, 'statics', 'dynamics', 'thermo', 'fluids', 'mom', 'aerodynamics', 'controls', 'aerostructures', 'propulsion'],
  },
  sysdesign: {
    name: 'Systems Design Engineering', faculty: 'Engineering', weight: 0.4, electives: ['cs', 'mech', 'stat', 'bus'],
    core: [...ENG_Y1, 'probability', 'signals', 'controls', 'hci', 'optim', 'ml', 'pm', 'numerical'],
  },
}

/** Which disciplines a university teaches: everything its programs need. */
export function disciplinesFor(u: UniversitySpec): Set<Discipline> {
  const out = new Set<Discipline>(['gen'])
  for (const key of u.programs) {
    const p = PROGRAMS[key]
    for (const conceptKey of p.core) {
      const c = CONCEPTS.find((x) => x.key === conceptKey)
      if (c) out.add(c.disc)
    }
    for (const d of p.electives) out.add(d)
  }
  return out
}
