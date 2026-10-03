import path from 'node:path';
const deps=path.resolve(process.env.SITE_NODE_MODULES||'../runtime/react-toolchain/node_modules');
const {default:react}=await import(path.join(deps,'@vitejs/plugin-react/dist/index.js'));
export default {base:'./',css:{postcss:{plugins:[]}},plugins:[react()],resolve:{alias:{react:path.join(deps,'react'),'react-dom':path.join(deps,'react-dom')}}};
