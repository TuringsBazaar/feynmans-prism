# Focused ultrasound results

Ranked results for the research questions in
`graphs/corpus/nano-questions.md` and `graphs/corpus/micro-questions.md`,
computed against the 46-paper PostgreSQL table and the active heuristics
in `graphs/corpus_ingest/rwx.md`.

```bash
export DATABASE_URL="postgresql://postgres@localhost:5432/propagate"
uv run rwx-policy --questions graphs/corpus/nano-questions.md
uv run rwx-policy --questions graphs/corpus/micro-questions.md
```

Paper probabilities are scores normalized over the five displayed papers, not
calibrated probabilities of research quality. `[calibrate]`/`[accept]` is the
H4 optimal-stopping annotation. RWX decimals use the default empty research
state (no reading, notes, hypotheses, or experiments supplied).

## nano-questions.md

### Define appropriate neuromodulation dose parameters for TUS

Probability distribution over papers:

- 0.2602 Low-intensity transcranial focused ultrasound amygdala neuromodulation: a double-blind sham-controlled target engagement study and unblinded single-arm clinical trial — [calibrate]
- 0.2471 Acoustically activatable liposomes as a translational nanotechnology for site-targeted drug delivery and noninvasive neuromodulation — [calibrate]
- 0.2100 Non-invasive in vivo acoustoelectric neuromodulation and its contribution to ultrasound stimulation — [calibrate]
- 0.1490 A review of predictive nonlinear theories for multiscale modeling of heterogeneous materials — [calibrate]
- 0.1337 A deep‐learning model for one‐shot transcranial ultrasound simulation and phase aberration correction — [calibrate]

RWX decimals:

- read 0.8889
- write 0.0556
- execute 0.0556

### Determine exact optimal parameters of 3D-printed holographic acoustic lenses for transcranial FUS

Probability distribution over papers:

- 0.2110 A deep‐learning model for one‐shot transcranial ultrasound simulation and phase aberration correction — [calibrate]
- 0.2053 Low-intensity transcranial focused ultrasound amygdala neuromodulation: a double-blind sham-controlled target engagement study and unblinded single-arm clinical trial — [calibrate]
- 0.1968 ITRUSST consensus on standardised reporting for transcranial ultrasound stimulation — [calibrate]
- 0.1940 Benchmark problems for transcranial ultrasound simulation: Intercomparison of compressional wave models — [calibrate]
- 0.1928 Directional Acoustic Antennas Based on Valley‐Hall Topological Insulators — [calibrate]

RWX decimals:

- read 0.8889
- write 0.0556
- execute 0.0556

## micro-questions.md

### Define appropriate neuromodulation dose parameters for TUS

Probability distribution over papers:

- 0.2602 Low-intensity transcranial focused ultrasound amygdala neuromodulation: a double-blind sham-controlled target engagement study and unblinded single-arm clinical trial — [calibrate]
- 0.2471 Acoustically activatable liposomes as a translational nanotechnology for site-targeted drug delivery and noninvasive neuromodulation — [calibrate]
- 0.2100 Non-invasive in vivo acoustoelectric neuromodulation and its contribution to ultrasound stimulation — [calibrate]
- 0.1490 A review of predictive nonlinear theories for multiscale modeling of heterogeneous materials — [calibrate]
- 0.1337 A deep‐learning model for one‐shot transcranial ultrasound simulation and phase aberration correction — [calibrate]

RWX decimals:

- read 0.8889
- write 0.0556
- execute 0.0556

### Determine the appropriate time-averaging window for spatial-peak time-average intensity (I_spta) in TUS (link)

Probability distribution over papers:

- 0.2346 Low-intensity transcranial focused ultrasound amygdala neuromodulation: a double-blind sham-controlled target engagement study and unblinded single-arm clinical trial — [calibrate]
- 0.2322 Functional ultrasound imaging of human brain activity through an acoustically transparent cranial window — [calibrate]
- 0.1850 A review of predictive nonlinear theories for multiscale modeling of heterogeneous materials — [calibrate]
- 0.1823 Broadband Acoustic Intensity Direction Estimation with Tight-Frame Cardioid Arrays — [calibrate]
- 0.1659 A deep‐learning model for one‐shot transcranial ultrasound simulation and phase aberration correction — [calibrate]

RWX decimals:

- read 0.8889
- write 0.0556
- execute 0.0556

### Determine exact optimal parameters of 3D-printed holographic acoustic lenses for transcranial FUS (link)

Probability distribution over papers:

- 0.2114 A deep‐learning model for one‐shot transcranial ultrasound simulation and phase aberration correction — [calibrate]
- 0.2054 Low-intensity transcranial focused ultrasound amygdala neuromodulation: a double-blind sham-controlled target engagement study and unblinded single-arm clinical trial — [calibrate]
- 0.1967 ITRUSST consensus on standardised reporting for transcranial ultrasound stimulation — [calibrate]
- 0.1938 Benchmark problems for transcranial ultrasound simulation: Intercomparison of compressional wave models — [calibrate]
- 0.1926 Directional Acoustic Antennas Based on Valley‐Hall Topological Insulators — [calibrate]

RWX decimals:

- read 0.8889
- write 0.0556
- execute 0.0556

### Mechanisms underlying PRF-dependent lesion growth in HCT histotripsy (link)

Probability distribution over papers:

- 0.2464 Altitude-Dependent Near-Source Spectral Filtering of Meteor Infrasound Above 80 km and Consequences for Period-Based Energy Estimates — [calibrate]
- 0.2061 A review of predictive nonlinear theories for multiscale modeling of heterogeneous materials — [calibrate]
- 0.1848 A deep‐learning model for one‐shot transcranial ultrasound simulation and phase aberration correction — [calibrate]
- 0.1816 Towards understanding two-level-systems in amorphous solids: insights from quantum circuits — [calibrate]
- 0.1810 QUANTUM ESPRESSO: a modular and open-source software project for quantum simulations of materials — [calibrate]

RWX decimals:

- read 0.8889
- write 0.0556
- execute 0.0556

### Cavitation/bubble-driven modification of standing-wave fields in HCT lumens (link)

Probability distribution over papers:

- 0.2515 Benchmark problems for transcranial ultrasound simulation: Intercomparison of compressional wave models — [accept]
- 0.2040 Fresnel's Mechanical Legacy Recovered: The Drag Coefficient from Carried Compliance, and the Two Laws Bubble Acoustics Separates — [calibrate]
- 0.1909 A review of predictive nonlinear theories for multiscale modeling of heterogeneous materials — [calibrate]
- 0.1824 Gravity wave dynamics and effects in the middle atmosphere — [calibrate]
- 0.1712 A deep‐learning model for one‐shot transcranial ultrasound simulation and phase aberration correction — [calibrate]

RWX decimals:

- read 0.8889
- write 0.0556
- execute 0.0556

### Degree of pulse nonlinearity for 10 µs HCT pulses (link)

Probability distribution over papers:

- 0.2350 Fresnel's Mechanical Legacy Recovered: The Drag Coefficient from Carried Compliance, and the Two Laws Bubble Acoustics Separates — [accept]
- 0.2218 Negative-Poisson's-Ratio Materials: Auxetic Solids — [accept]
- 0.1956 A review of predictive nonlinear theories for multiscale modeling of heterogeneous materials — [calibrate]
- 0.1754 A deep‐learning model for one‐shot transcranial ultrasound simulation and phase aberration correction — [calibrate]
- 0.1723 Towards understanding two-level-systems in amorphous solids: insights from quantum circuits — [calibrate]

RWX decimals:

- read 0.8889
- write 0.0556
- execute 0.0556

### Effect of intraluminal liquefaction on aspiration catheter clot ingestion (link)

Probability distribution over papers:

- 0.2214 A review of predictive nonlinear theories for multiscale modeling of heterogeneous materials — [calibrate]
- 0.1985 A deep‐learning model for one‐shot transcranial ultrasound simulation and phase aberration correction — [calibrate]
- 0.1951 Towards understanding two-level-systems in amorphous solids: insights from quantum circuits — [calibrate]
- 0.1945 QUANTUM ESPRESSO: a modular and open-source software project for quantum simulations of materials — [calibrate]
- 0.1906 Acoustoelectric imaging of deep dipoles in a human head phantom for guiding treatment of epilepsy — [calibrate]

RWX decimals:

- read 0.8889
- write 0.0556
- execute 0.0556

### Establish an optimal CT-to-acoustic-velocity mapping for skull elastic properties (especially shear speed) (link)

Probability distribution over papers:

- 0.2090 A comparative study of data- and image- domain LSRTM under velocity–impedance parametrization — [calibrate]
- 0.2081 Directional Acoustic Antennas Based on Valley‐Hall Topological Insulators — [calibrate]
- 0.2074 Acoustic resonators above 100 GHz — [calibrate]
- 0.1899 SCOUT: Skull-Corrected Optimization for Ultrasound Transducers — [calibrate]
- 0.1855 Magnetic Resonance Acoustic Radiation Force Imaging ( MR ‐ ARFI ) — [calibrate]

RWX decimals:

- read 0.8889
- write 0.0556
- execute 0.0556

### Account for scalp-generated photoacoustic signals and skull reflections that corrupt cortical signals (link)

Probability distribution over papers:

- 0.2524 Dataset for "De-aberration for noninvasive transcranial photoacoustic computed tomography through an adult human skull" — [calibrate]
- 0.2047 Ultrasonic reporters of calcium for deep tissue imaging of cellular signals — [calibrate]
- 0.1851 SCOUT: Skull-Corrected Optimization for Ultrasound Transducers — [calibrate]
- 0.1799 Observations of the seiche that shook the world — [calibrate]
- 0.1780 Photoacoustic Tomography: In Vivo Imaging from Organelles to Organs — [calibrate]

RWX decimals:

- read 0.8889
- write 0.0556
- execute 0.0556
