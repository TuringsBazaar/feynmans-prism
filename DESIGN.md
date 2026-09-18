take inspiration from webtorrent as a distributed network for feynman autoresearch

features:
- see select open problems from emergent mind
- the more work you do, the more devices you can allocate. work: research you submit, peer reviewing other research, or the more friends you invite
- joining rooms like webtorrent. filled = joined problem, plays @static_sound_play.wav, unchecked: paused. it plays static_sound_disable.wav
- expand problem: see the subproblems
- see how many other peers per problem. have fake dummy peer function initially. join. disconnect functions. these influence the numbers. later, these placeholder functions can be populated

UX:
- anyone with a laptop opens the url: feynman.network/join to enter feynman's rainbow
displays: username, total contribution, devices owned. here, the more contributions, the more devices owned.
- Nonacris
- Eridanus
- Corinth
- Mitylene
- Pyrenees
- Thrace
- Inachos
- Diana
- Jupiter
- Saturnia
- Naiad
- Nereid
- Erymanthus
- Coronis
- Nyctimene
- Thessaly
- Vulcan
- Lemnos
- Tyrrhenian - pirates

one-time setup, with some 
`curl -fsSL https://feynman.network/join | sh`
going on in the terminal. the TUI shows up
one time configuration of how to connect compute over some protocol #question: what protocol

users can browse problems and the tree of broken down problems and self-enroll in working on a problem

they can also toggle view maps or trees in cli
tiers:
iron: 1 device, can accept work, can't assign work
bronze: more devices, can propose subproblems to work on
silver: more devices, can assign jobs, can submit additional nodes
gold: even more devices and greater assignment power. maybe assign assigners.
this is relative to the whole graph, and can be periodically recalculated. e.g. duolingo weekly rankings

TUI example:
```
$ curl -fsSL https://feynman.network/join | sh

Feynman's Prism.

(copy tailscale ui here for the first few sentences)
devices: 
[Eridanus] | macOS arm64 | available CPU: 8 cores | working on #1
[Mitylene] | browser | 2 CPU | offline
[Nonacris] | linux x86_64 | 16 CPU | working #5

research:      
-─────────────────────────────────────────────────────────────────────────────
│ ○ ▸ Biological credit assignment                             1 peer 50k tok │
│ ○ ▸ Subspace conditional Poincaré inequality                  0 peers — tok │
│ ○ ▸ Spiked tensor detection thresholds                        0 peers — tok │
│ ○ ▸ Noise reduction information capacity                      0 peers — tok │
│ ○ ▸ Temporal mutual-information degeneracy                    0 peers — tok │
└─────────────────────────────────────────────────────────────────────────────
[p] propose subproblem [space] to join [v] view problem tree

Permissions:
[checkmark] accept work
[checkmark] propose subproblems
[-] assign work
```
algorithms and protocols:
- devices join like tailscale. tailscale uses DISCO for discovery, wireguard for protocol for device encryption. this is by analogy implemented with Hyperswarm connections in v0. It uses Noise xx handshake over ed25519. DHT is used. Use Tailscale later.
- problem ingestion and tree decomposition: hardcoded for now. need: hierarchical problem decomposition + dynamic dependency graph as peers contribute fragments
- problem traversal representation: like roman roads, or ant colony optimization or active matter algorithms. currently conceptual, not implemented. could use connectedpapers as a first step. however in the future, connections should be idea-based rather than strictly citation based
- verification: 
version 1: AI-assisted peer review other's contributions, marking as major or minor contribution

users can progressively apply these prompts from rwx cycles. can be like an interruption from the cli. user sees prompt. at each level the user has to manually approve it.
level 0: [insert link] look around! As a leading expert in [autofill: domain], explain this lab's research canon and how it situates in the contemporary work ranked by originality, then point to individual significant papers of interest.

level 1: You are a research methodology expert. For each draft submitted, identify the major vs minor contributions buried in this data, rank them by originality, and show with precision and accuracy where each one challenges or extends existing literature. Use bold text very sparingly for notetaking in Logseq. Provide a glossary for a technical 20 year old. For each formula, provide intuition for reconstructing it step by step, with patterns understandable to the 20 year old. Do not use bold text.

level 2: still acting as the research methodology expert, explain from the primitives level how they designed the pipeline, the quality and type of evidence and reasoning used, and consistency.

level 3: Michelin-tabling question (if you're meeting with the authors) As a leading [autofill: domain], you find yourself at a fancy lunch with the authors. Read the discussion or looking forward section while thinking granularly. What are the 3 quirky follow-up questions that you would discuss with the team? What are the 3 key implications of this argument that you would encourage the authors to think about?

at any point the user can review the AI assisted peer review.


REVIEW #1

Key technical hinges of work:
- #1: Evaluator disagreement predicts benchmark failure.
- #2:  ... 
- #3:  ...

Critiera, referenced from NeurIPS 2026.
Quality. soundness and validity. Is this research honest and compares with equal units? Are conceptually novel ideas grounded in previous theoretical frameworks and solid engineering (if relevantmult)
  [4] strongly supported

Clarity
  [3] good

Originality
  [3] substantially new

Significance:
Downstream impact
  Unlocks: #190, #191, #204, #208
  Estimated amplification: 7.4

Confidence
  [3] familiar with relevant literature

Recommendation
  [] above acceptance
  [] average
  [] reject
  [] desk reject
since this system is async compared to neurips that is more sync, research can pile up and peer review can happen in batches

- later versions: avoid peer review, quadrant of autoresearch + amplification factor calculation
amplification factor calculation is based on an original problem situation and where contribution sits in some sort of forward dependency graph

quadrant of autoresearch:
ideally we would want new insights that is also encoded in very few bits. often times autoresearch discovers new things but is encoded in too many bits. or discover nothing and encodes it in few bits. or discover nothing and encode in too many bits. 
- metrics: does a fragment of research help amplify downstream research? shannon entropy or mutual information.

check top peers: in terms of work
- reference ![](torrent-peers.png)
- the problem list is from @open-problems-sept-11, including the credit assignment problem and 4 others
- subproblems from the graph inside @research-tree-test

versions:
- v0: can use pear/hyperswarm as referenced in https://github.com/exanova-y/pear-to-pear to commuincate. see guillefix.cjs
stack

roadmap:
- reticulum for networking with other feynmans, which is device agnostic and beautiful
- visit caltech tunnels and create a tunnel there

implementation status & notes:
please refer to @AGENT.md for coding expectations
