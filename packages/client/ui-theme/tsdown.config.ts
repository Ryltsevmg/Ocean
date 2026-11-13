import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(
  import.meta.dirname,
  ['lib/types/index.js'],
  {
    lib: {
      copy: [{
        from: 'src/styles/{brand-font.css,montserrat-*.woff2,Montserrat-OFL.txt,InterVariable.woff2,Inter-LICENSE.txt}',
        to: 'lib/styles',
      }],
    },
  },
)
