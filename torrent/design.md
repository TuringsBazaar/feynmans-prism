aim: taking inspiration from webtorrent as a distributed network for feynman autoresearch, starting dead simple first

features:
- see all problems
- checkbox. filled = joined problem, plays @static_sound_play.wav, unchecked: paused. it plays static_sound_disable.wav
- expand problem: see the subproblems within a problem and the token count
- see how many other peers per problem. have fake dummy peer function initially. join. disconnect functions. these influence the numbers. later, these placeholder functions can be populated
- keep it very simple and minimalistic

UI:
- reference ![](torrent-peers.png)
- the problem list is from @open-problems-sept-11, including the credit assignment problem and 4 others
- subproblems from the graph inside @research-tree-test

stack:
- vite, react, typescript. 
- zustand for state management
- reticulum for networking with other feynmans, python

versions:
- v0: localhost. common js for joining a synchronous room. can use pear/hyperswarm as referenced in https://github.com/exanova-y/pear-to-pear to commuincate. see guillefix.cjs

implementation status & notes:

randomly name pears:
- inital pears: aman, guillefix, alex, yoyo, lucy
- new pears: aayush, sudarsh, lev, celeste, ada, lydia, yudhister, malaika, pavrati, amir, ihar, gwern
