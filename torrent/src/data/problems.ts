import type { Problem, Subproblem } from '../types'

const q = (text: string): Subproblem => ({ kind: 'open_question', text })

const creditAssignmentSubproblems: Subproblem[] = [
  q('What are the fundamental causes of the performance and scalability gap between forward-only algorithms and backpropagation, particularly regarding layer collaboration during training?'),
  q('Can weight mirroring strategies be meaningfully extended to convolutional architectures beyond fully connected networks?'),
  q('How can the temporal non-locality of PEPITA (requirement to retain first-pass information until second pass) be reconciled with biological plausibility, and what neuromodulatory signals could distinguish the two passes?'),
  q('Can a learning rule be developed that relaxes the full set of backpropagation assumptions (weight transport, update locking, global error signals) while maintaining deep-learning scalability and task performance comparable to modern supervised learning?'),
  q('How can neuromorphic substrates be leveraged to scale deep credit assignment beyond local plasticity rules, and what would the substrate-level mechanism need to accomplish?'),
  q('Which sparse configurations in the joint taxonomy (state-dynamics × credit-assignment) represent genuine research gaps versus conceptual incompatibilities or taxonomy artifacts?'),
  q('Do the resource-allocation properties of constrained Hebbian learning extend to fully unprocessed multimodal inputs and beyond audiovisual domains to text, graphs, and tabular data?'),
  q('Are the low-CTI representations induced by constrained Hebbian learning also more selective, disentangled, or interpretable than backpropagation or DDTP-trained representations?'),
  q('How do local Hebbian mechanisms perform when combined with recurrent, spiking, and inhibitory–excitatory architectures, and what additional stabilization mechanisms enable scaling beyond shallow networks?'),
  q('Can local Hebbian learning achieve comparable resource-allocation efficiency when integrated with feedback-driven allocation of representational resources or synaptic tagging mechanisms?'),
]

const placeholder = (): Subproblem[] => [
  { kind: 'open_question', text: 'Not yet extracted — populate from a future run.' },
]

export const PROBLEMS: Problem[] = [
  {
    id: 'credit-assignment',
    title:
      'Establish effective methodologies to improve, scale, and rigorously test the capabilities of biologically plausible credit assignment algorithms, including predictive coding, contrastive Hebbian learning, and forward-only learning, and develop experimental protocols to empirically verify the specific claims these algorithms imply about cortical processing.',
    subproblems: creditAssignmentSubproblems,
    tokens: 50000,
  },
  {
    id: 'poincare-inequality',
    title:
      'Establish the subspace conditional Poincaré inequality for general finite-rank orthogonal projectors under infinite-dimensional uniform product measures, thereby converting active-subspace tail-energy bounds for affine uniform elliptic PDEs into ridge-reconstruction error bounds.',
    subproblems: placeholder(),
    tokens: null,
  },
  {
    id: 'noise-capacity',
    title:
      'Determine how to predict, from the original noisy data, the information processing capacity that will result after applying noise-reduction strategies such as averaging repeated state traces.',
    subproblems: placeholder(),
    tokens: null,
  },
  {
    id: 'spiked-thresholds',
    title:
      'Determine rigorous signal detection thresholds for spiked models as a function of data type; specifically, establish precise detectability conditions for low-rank signals embedded in high-dimensional noise for spiked matrix and spiked tensor settings.',
    subproblems: placeholder(),
    tokens: null,
  },
  {
    id: 'degeneracy',
    title:
      'Establish whether the original temporal mutual-information analysis of degeneracy can be applied to neuromechanical models that exhibit a stationary regime.',
    subproblems: placeholder(),
    tokens: null,
  },
]