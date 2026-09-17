a brief history of the project:
this is an evolving project on how to make autoresearch better 
- it is based off of feynman autoresearch
- users can torrent open problems from emergent mind, the torrent part of this project can be found in @DESIGN.md

sept 1 - sept 14:
- feynman autoresearch clone itself included in this repo, and a helm mirror was constructed to be it's meter
- acoustics code. it should be moved into https://github.com/exanova-y/propagate-yourself.git
- my friend and I were talking to each other over hyperbeam using @guillefix.cjs (synchronous, preferred over .mjs)
- a group of deepseeks were talking to each other over hyperswarm as they worked on a selection of emergent mind open problems. they took on different roles: researcher, compressor, logger
- a torrent cli was prototyped in UI
- the credit assignment from emergent mind was broken down into a tree
- the peers shall receive fragments of the problem statements from the tree


here are the scrap notes that I took:
A distributed network of Feynmans worldwide churning on open research questions from emergent mind. Someone could get a feynman “torrent client”. e.g. Ihar, who is geographically limited but has tenstorrent hardware. And he gets assigned particular problem fragments.

UI:
Users can connect to particular problems. The UI looks like WebTorrent (I LOVE THE SOUNDS OF WEBTORRENT!). Except each movie is an open problem from emergent mind. It can be from the web or on their desktop


Logic, note taking and brainstorming
Bittorrent:
- Want to download a large file using minimal internet bandwidth
- user requests file. finds a swarm with the said file. the file is split into fragments and each fragment is downloaded by a peer.
- tit for tat: to avoid leeching, the more you upload, the faster you can download
- central tracker (in the history of bittorrent) identifies the swarm


Problem brainstorming:
- User wants to solve a frontier research problem with maximal progress on minimal compute
- User self selects a problem. A central tracker identifies the swarm of peers
- The more problem a user works on, ??? There is no direct analogy to faster download. Since, verification of a research fragment needs to be defined first. However, the more problems a user works on, the more compute access it will have to churn research faster.
- validation: to ensure a unit of research is valid, it needs to be peer-reviewed. every author who submits a paper to NeurIPS also is assigned a paper to review through an algorithm. the peer review process can reference scholar inbox sign up process: the user rates the paper based on title and abstract to their own taste. since according to https://arxiv.org/abs/2501.13014 there is no relation between reviewer scoring of paper and paper quality
- the quadrant of autoresearch failure modes: so ideally we would want new insights that is also encoded in very few bits. often times autoresearch discovers new things but is encoded in too many bits. or discover nothing and encodes it in few bits. or discover nothing and encode in too many bits. 
- metrics: does a fragment of research help amplify downstream research? shannon entropy or mutual information. vs description length. highest entropy per description length


flow:
- users: compute providers and researchers (with overlap)
- submit framgnet
- coordinator allocates fragments based on individual Velocity and Causal Influence

People can open a magnet link. there should be a chrome extension where *something* turns into a magnet link and the webtorrent client can get it. like emergent mind problem–except that emergent mind limits api usage to 25 problems per day so its not scalable. or any problem in a future work section of an arxiv paper. see alphaxiv chrome extension modifies an arxiv paper. the same principle can apply. A group of people can open the same magnet link (very small group?).
when people sign up for quora, it asks them to choose 3 topics before they can self-select.
problems with torrent:
- there are not enough pears working on the same problem.

Whenever the user is on emergent mind open problems, they can get the hash of the doi. It opens a room. Later versions can extend to any paper. Constraint: the paper must be open access, for now
A decentralized vs a centralized assigner for problems?
How much compute do we need?
Sci hub analogy. Checks the internal database of “trees” and derivative “trees”
A graph of research that is differentiable. The derivative of the research tree represents a tree of tangible work, that would be assigned to various nodes.
Reference: webtorrent runs on webrtc (layer 7) compared to bittorrent which runs on tcp/udp (layer 4 transport layer)
We can ask Jade Wang about the design



Centralized assignment for now for the sake of debugging. When it 

Problem domains
It can work on any problem I find interesting, even elementary differential geometry problems
Control theory
Dynamical systems
They can write science fiction! (not verifiable)

Peer joining:
Node could optionally provide compute
BitTorrent and Webtorrent are similar protocols

Webtorrent: Uses WebRTC between browsers since browsers provide no access to TCP or UDP sockets
BitTorrent: uses 
The two could not communicate
Reticulum Network is hardware-agnostic and at OSI layer 3. Maybe keep this for future scaling onto different hardware
A torrent seeder is a user who has 100% of a file and keeps their client open to upload it

Roman Roads
Feynman autoresearch has 8k stars on GitHub and already 1k forks from existing dissatisfied users, showing a strong need for enhancement. An average Feynman session burns 30k tokens elapsing multiple minutes, spawning 4 agents including the reviewer, verifier and writer agents coordinate sequentially, progressing from skill → prompts → generating new code → plans → notes → drafts → final outputs. 

We can use the analogy from Roman streets, since they are engineering spectacles. If some agent has already explored this topic space, highways like Via Egnatia should be constructed to avoid independent and identical exploration by a future agent! Unproductive roads can be demoted from viae publicae to viae vicinales, marked as dead-ends or topics could be tossed into the sewers. When needed, shortcuts between roads could be created.



Suppose Feynman agent is set off to research "Scaling laws for Neural Language Models" and it thinks "neuro" and "what becomes bottleneck in BCIs as number of electrodes grows" and then "Physical Principles for Scalable Neural Recordings". After Feynman has thought about this, future agents don't need to walk every cobblestone.  They can just jump directly from "scaling laws" to "physical principles ..." through a weird structural/analogical street compared to a citation graph or semantic embeddings. This would be faster and more memory efficient. A weaker connection for two topics is "Dario Amodei". Although he is the common author on both papers, this "common author" street does not inform why the previous road is intellectually interesting. This is one path that present autoresearch often takes. The Roman roads and cities are differentiable and trainable. When the graph is differentiable, the chain rule could be used to trace where the errors come from (credit assignment). If taking certain routes repeatedly leads to good research, gradient descent can teach the model to prefer these roads.

- try a sql database for a particular problem and representing it in a tree
- Next: try PyTorch geometric and Mikhail Galkin's work. to build new roads between ideas explored. Give autoresearch another literature database given 100 - 200 papers in. Check to see system could generate new hypotheses compared to unimproved Feynman
- rwx research policy like from @rwx.md
