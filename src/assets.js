import { imageBytes } from './project.js';
import { questionImages } from './content.js';
const files = {
  regular: 'LiberationSans-Regular.ttf', bold: 'LiberationSans-Bold.ttf',
  italic: 'LiberationSans-Italic.ttf', boldItalic: 'LiberationSans-BoldItalic.ttf',
  school: 'school-logo.jpg', cambridge: 'cambridge-logo.png', skeleton: 'skeleton.png',
};
let loaded;
export function loadAssets() {
  loaded ||= Promise.all(Object.entries(files).map(async ([key, name]) => {
    const response = await fetch(`${import.meta.env.BASE_URL}assets/${name}`);
    if (!response.ok) throw new Error(`Could not load ${name}. Reconnect to finish downloading the app.`);
    return [key, new Uint8Array(await response.arrayBuffer())];
  })).then(entries => Object.fromEntries(entries)).catch(error => { loaded = null; throw error; });
  return loaded;
}

export async function projectAssets(project) {
  const assets = { ...await loadAssets() };
  for (const question of project.paper.questions) for (const image of questionImages(question)) {
    const name = image.name;
    if (project.images[name]) assets[name] = imageBytes(project.images[name].dataUrl);
    if (!assets[name]) throw new Error(`The diagram for “${question.title || 'Untitled question'}” is missing. Attach it again.`);
  }
  return assets;
}
