# Contributing

Run Node.js 24, then `npm ci` and `npm run dev`. The first run downloads the official hand model. Before submitting a change, run `npm test` and `npm run build`.

For interaction changes, test mouse mode first. For camera changes, record the browser, operating system, GPU/CPU delegate and whether a real hand was tested. Never record or upload camera footage without explicit consent.

For performance reports, distinguish rendering FPS from inference duration and describe whether the delay occurs with the mouse or only with a hand. Keep the local-processing privacy boundary and the single-inference rule intact.

Open a focused pull request explaining the observed problem, resulting behaviour and checks run. Do not include node_modules, downloaded model/WASM files, logs or credentials.

No open-source license has been selected. Public visibility alone does not grant broad reuse rights.
