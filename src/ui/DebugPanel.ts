import GUI from 'lil-gui';
import { config, normalizeRadii } from '../config';

export function createDebugPanel(reset: () => void): GUI {
  document.body.classList.add('debug');
  const gui = new GUI({ title: 'SHOAL / 調整パネル', width: 280 });
  const school = gui.addFolder('群れの動き');
  for (const [key, label, min, max] of [
    ['repulsion', '反発の半径', 0.2, 3], ['alignment', '整列の半径', 1, 15], ['attraction', '引き寄せの半径', 2, 25],
  ] as const) school.add(config.school, key, min, max, 0.1).name(label).listen().onChange(normalizeRadii);
  school.add(config.school, 'fieldOfView', 60, 360, 5).name('視野（°）');
  school.add(config.school, 'cruiseSpeed', 1, 8, 0.1).name('巡航速度');
  school.add(config.school, 'maxSpeed', 8, 18, 0.1).name('最大速度');
  school.add(config.school, 'turnRate', 30, 360, 10).name('最大旋回（°/秒）');
  school.add(config.school, 'noise', 0, 20, 0.5).name('方向の揺らぎ');
  school.add(config.school, 'attractionWeight', 0, 1, 0.01).name('引き寄せの強さ');
  const informed = gui.addFolder('その気');
  informed.add(config.informed, 'seconds', 0.2, 6, 0.1).name('仲間になる秒数');
  informed.add(config.informed, 'radius', 2, 15, 0.5).name('仲間になる半径');
  informed.add(config.informed, 'angle', 10, 90, 1).name('向きの差（°）');
  informed.add(config.informed, 'weight', 0, 2, 0.05).name('向きへの重み');
  informed.add(config.informed, 'coolRadius', 10, 60, 1).name('冷める距離');
  informed.add(config.informed, 'coolSeconds', 1, 30, 1).name('冷める秒数');
  const predators = gui.addFolder('天敵・再合流');
  predators.add(config.predators, 'fleeRadius', 8, 25, 1).name('逃避半径');
  predators.add(config.predators, 'fleeWeight', 1, 5, 0.1).name('逃げる強さ');
  predators.add(config.predators, 'regroupRadius', 10, 30, 1).name('再合流の近隣半径');
  predators.add(config.predators, 'regroupSeconds', 0, 10, 0.5).name('再合流の持続秒数');
  predators.close();
  gui.add(config.school, 'count', config.school.minCount, config.school.maxCount, 100).name('魚の数（再開始）').onFinishChange(reset);
  gui.add({ reset }, 'reset').name('同じ条件でやり直す');
  return gui;
}
