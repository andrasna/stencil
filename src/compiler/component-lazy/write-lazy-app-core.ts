import * as d from '@declarations';
import { formatComponentRuntimeMeta, stringifyRuntimeData } from '../app-core/format-component-runtime-meta';
import { optimizeAppCoreBundle } from '../app-core/optimize-app-core';
import { sys } from '@sys';
import { DEFAULT_STYLE_MODE } from '@utils';


export async function writeLazyAppCore(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, destinations: string[], build: d.Build, rollupResults: d.RollupResult[], bundleModules: d.BundleModule[]) {
  const appCoreRollupResult = rollupResults.find(r => r.isAppCore);
  console.log(rollupResults.filter(r => r.isAppCore).length);
  const lazyRuntimeData = formatLazyBundlesRuntimeMeta(bundleModules);
  await writeLazyAppCoreResults(config, compilerCtx, buildCtx, destinations, build, lazyRuntimeData, appCoreRollupResult);
  return appCoreRollupResult.fileName;
}

async function writeLazyAppCoreResults(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, destinations: string[], build: d.Build, lazyRuntimeData: string, rollupResult: d.RollupResult) {
  let code = rollupResult.code.replace(
    `[/*!__STENCIL_LAZY_DATA__*/]`,
    `${lazyRuntimeData}`
  );

  if (config.minifyJs) {
    const results = await optimizeAppCoreBundle(compilerCtx, build, code);

    buildCtx.diagnostics.push(...results.diagnostics);

    if (buildCtx.shouldAbort) {
      return;
    }

    code = results.output;
  }

  // inject the component metadata
  await Promise.all(destinations.map(dst => {
    const filePath = sys.path.join(dst, rollupResult.fileName);
    return compilerCtx.fs.writeFile(filePath, code);
  }));
}


function formatLazyBundlesRuntimeMeta(bundleModules: d.BundleModule[]) {
  // [[{ios: 'abc12345', md: 'dec65432'}, {cmpTag: 'ion-icon', cmpMembers: []}]]

  const lazyBundles = bundleModules
    .map(bundleModule => formatLazyRuntimeBundle(bundleModule));

  return stringifyRuntimeData(lazyBundles);
}


function formatLazyRuntimeBundle(bundleModule: d.BundleModule): d.LazyBundleRuntimeData {
  let bundleId: any;
  if (bundleModule.outputs.length === 0) {
    throw new Error('bundleModule.output must be at least one');
  }

  if (bundleModule.outputs[0].modeName !== DEFAULT_STYLE_MODE) {
    // more than one mode, object of bundleIds with the mode as a key
    bundleId = {};
    bundleModule.outputs.forEach(output => {
      bundleId[output.modeName] = output.bundleId;
    });

  } else {
    // only one default mode, bundleId is a string
    bundleId = bundleModule.outputs[0].bundleId;
  }

  return [
    bundleId,
    bundleModule.cmps.map(cmp => formatComponentRuntimeMeta(cmp, true, true))
  ];
}