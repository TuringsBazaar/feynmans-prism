### Short proposal

Feynman autoresearch has 8k stars on GitHub and already 1k forks from existing dissatisfied users, showing a strong need for enhancement. An average Feynman session burns 30k tokens elapsing multiple minutes, spawning 4 agents including the reviewer, verifier and writer agents coordinate sequentially, progressing from skill → prompts → generating new code → plans → notes → drafts → final outputs. 
We can use the analogy from Roman streets, since they are engineering spectacles. If some agent has already explored this topic space, highways like Via Egnatia should be constructed to avoid independent and identical exploration by a future agent! Unproductive roads can be demoted from viae publicae to viae vicinales, marked as dead-ends or topics could be tossed into the sewers. When needed, shortcuts between roads could be created.

![](via-egnatia.png)

Suppose Feynman agent is set off to research "Scaling laws for Neural Language Models" and it thinks "neuro" and "what becomes bottleneck in BCIs as number of electrodes grows" and then "Physical Principles for Scalable Neural Recordings". After Feynman has thought about this, future agents don't need to walk every cobblestone.  They can just jump directly from "scaling laws" to "physical principles ..." through a weird structural/analogical street compared to a citation graph or semantic embeddings. This would be faster and more memory efficient. A weaker connection for two topics is "Dario Amodei". Although he is the common author on both papers, this "common author" street does not inform why the previous road is intellectually interesting. This is one path that present autoresearch often takes. The Roman roads and cities are differentiable and trainable. When the graph is differentiable, the chain rule could be used to trace where the errors come from (credit assignment). If taking certain routes repeatedly leads to good research, gradient descent can teach the model to prefer these roads.

*Impact:*
A strong autoresearch tool good at representing, traversing ideas and generating new literature can be transferable to other fields. The pattern could be reused for any of Openlens or dread initiatives or across scientific fields in general, lab automation, engineering and electronics, chip design, neurotech. It could spend less tokens and costs per idea.

*Engineering implementation:*
- Building a strong autoresearch tool with better representations in neurotech
- Cluster 100 - 200 papers by semantics and explore
- First step: draw an architectural diagram, implement SQL database with vertices and edges with Feynman autoresearch in Typescript, give it a small literature database of given 100 - 200 papers/field reports in neuromodulation, and check its ability to generate and design new experiments. 
- Use a simple metric: Number of verified findings per time, per token.
- Next: try PyTorch geometric and Mikhail Galkin's work. to build new roads between ideas explored. Give autoresearch another literature database given 100 - 200 papers in. Check to see system could generate new hypotheses compared to unimproved Feynman
- On policy self distillation.
will be readjusted based on failures or success

Strong autoresearch should dominate weak autoresearch on certain problems such as emergent mind's open problem set. 
These are quantitative, verifiable problems where strong autoresearch could exploit problem structure and solve them easily with less compute/cost, and weak autoresearch will struggle via brute force. See brainstorming section for a list of various math problems.

