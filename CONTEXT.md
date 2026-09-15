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


Logic 
People can open a magnet link. there should be a chrome extension where *something* turns into a magnet link and the webtorrent client can get it. like emergent mind problem–except that emergent mind limits api usage to 25 problems per day so its not scalable. or any problem in a future work section of an arxiv paper. see alphaxiv chrome extension modifies an arxiv paper. the same principle can apply. A group of people can open the same magnet link (very small group?).
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
