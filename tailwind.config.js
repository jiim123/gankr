/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {}
  },
  // Design tokens (see CLAUDE.md "Style"): stick to Tailwind's built-in
  // neutral scale for chrome, blue for data values (match percentages and
  // similar), emerald for live/ready states. No gradients as decoration.
  //   background -> neutral-950   surfaces -> neutral-900   borders -> neutral-800
  //   primary action -> white bg, neutral-950 text   data -> blue-400/500   live -> emerald-400/500
  plugins: []
}
