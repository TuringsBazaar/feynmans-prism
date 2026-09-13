// Canonical seed data for the torch terminal UI.
// (The React UI under src/ is superseded by the terminal wireframe.)

export const INITIAL_PEARS = ['aman', 'guillefix', 'alex', 'yoyo', 'lucy']
export const SUBSEQUENT_PEARS = [
  'aayush', 'sudarsh', 'lev', 'celeste', 'ada', 'lydia', 'malaika',
  'pavrati', 'yudhister', 'amir', 'ihar', 'gwern',
]
export const PEAR_NAMES = [...INITIAL_PEARS, ...SUBSEQUENT_PEARS]

export const PROBLEMS = [
  {
    id: 'credit-assignment',
    title: 'Biological credit assignment',
    tokens: 30000,
    subproblems: [
      { text: 'predictive coding', tokens: null },
      { text: 'contrastive Hebbian learning', tokens: null },
      { text: 'forward-only learning', tokens: null },
    ],
  },
  {
    id: 'poincare-inequality',
    title: 'Subspace conditional Poincaré inequality',
    tokens: null,
    subproblems: [{ text: 'Not yet extracted — populate from a future run.', tokens: null }],
  },
  {
    id: 'spiked-thresholds',
    title: 'Spiked tensor detection thresholds',
    tokens: null,
    subproblems: [{ text: 'Not yet extracted — populate from a future run.', tokens: null }],
  },
  {
    id: 'noise-capacity',
    title: 'Noise reduction information capacity',
    tokens: null,
    subproblems: [{ text: 'Not yet extracted — populate from a future run.', tokens: null }],
  },
  {
    id: 'degeneracy',
    title: 'Temporal mutual-information degeneracy',
    tokens: null,
    subproblems: [{ text: 'Not yet extracted — populate from a future run.', tokens: null }],
  },
]
