# MLB pitch predictor — held-out validation metrics

- Val games: **1225** (deterministic ~5% hash split, same as train.py)
- Device: **cpu (1x cpu)** (inference only)

| head | model acc | baseline acc | model logloss | baseline logloss |
| --- | --- | --- | --- | --- |
| next_pitch_type | 0.5060 | 0.3358 | 1.1379 | 1.7184 |
| next_pitch_outcome | 0.3726 | 0.3536 | 1.4555 | 1.5488 |
| ab_outcome | 0.5326 | 0.4006 | 1.2122 | 1.5280 |
| home_win | 0.7774 | 0.5198 | 0.4792 | 0.6931 |

`next_pitch_type` per-count (balls,strikes) baseline acc: 0.3358 (in-sample, optimistic).
Home-win ECE: **0.0719**.

## Readout

On the held-out val games the model next_pitch_type 50.6% vs baseline 33.6% (beats by 17.0 pts); next_pitch_outcome 37.3% vs baseline 35.4% (beats by 1.9 pts); ab_outcome 53.3% vs baseline 40.1% (beats by 13.2 pts); home_win 77.7% vs baseline 52.0% (beats by 25.8 pts). Cross-entropy is lower than the marginal baseline where accuracy improves. Home-win predictions have an Expected Calibration Error of 0.0719 (0 = perfectly calibrated).
