/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // <alpha-value> lets Tailwind's opacity modifiers (bg-primary/50,
        // hover:bg-secondary-border/10, etc.) work with these oklch()
        // functions the same way they do for Tailwind's built-in palette.
        background: 'oklch(0.1543 0 0 / <alpha-value>)',
        foreground: 'oklch(0.9521 0 0 / <alpha-value>)',
        primary: {
          DEFAULT: 'oklch(0.6629 0.2272 35.97 / <alpha-value>)',
          foreground: 'oklch(0.9521 0 0 / <alpha-value>)'
        },
        secondary: {
          border: 'oklch(0.4731 0.1535 37.42 / <alpha-value>)'
        }
      }
    }
  },
  // Design tokens (see CLAUDE.md "Style"): background/foreground/primary are
  // the app's own brand colors (above), everything else stays on Tailwind's
  // built-in neutral scale for chrome (surfaces -> neutral-900, borders ->
  // neutral-800, secondary/tertiary text -> neutral-400/500), blue for data
  // values (match percentages and similar), emerald for live/ready states.
  // No gradients as decoration.
  //   background -> background   titles/primary text -> foreground
  //   primary action -> bg-primary, text-primary-foreground
  //   secondary action -> transparent bg, border-secondary-border, text-foreground
  plugins: []
}
