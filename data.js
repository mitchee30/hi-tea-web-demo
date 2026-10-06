/* =========================================================
   第一部分：数据
   所有选项都写成数组。以后换成真实菜单，只改这里就行。
   ========================================================= */
const TEAS = [
  { id: 'black',   name: '红茶',     color: '#7A3B12', price: 5.50 },
  { id: 'oolong',  name: '乌龙',     color: '#A8641F', price: 5.80 },
  { id: 'jasmine', name: '茉莉绿茶', color: '#C2A74A', price: 5.50 },
  { id: 'matcha',  name: '抹茶',     color: '#6E9A5B', price: 6.50 },
  { id: 'taro',    name: '芋头',     color: '#9B7FC4', price: 6.50 },
  { id: 'thai',    name: '泰式茶',   color: '#E0823A', price: 5.80 },
  { id: 'fruit',   name: '水果茶',   color: '#E8566E', price: 6.50 },
];
const MILKS = [
  { id: 'none', name: '不加奶', mix: 0,    price: 0 },
  { id: 'milk', name: '牛奶',   mix: 0.45, price: 0 },
  { id: 'oat',  name: '燕麦奶', mix: 0.40, price: 0.50 },
];
const SWEETS = [
  { id: 0, name: '无糖' }, { id: 30, name: '三分糖' }, { id: 50, name: '五分糖' },
  { id: 70, name: '七分糖' }, { id: 100, name: '全糖' },
];
const ICES = [
  { id: 'hot',    name: '热的',   cubes: 0 },
  { id: 'noice',  name: '去冰',   cubes: 0 },
  { id: 'less',   name: '少冰',   cubes: 2 },
  { id: 'normal', name: '正常冰', cubes: 4 },
];
const SIZES = [
  { id: 'M', name: '中杯', price: 0 },
  { id: 'L', name: '大杯', price: 0.80 },
];
const TOPPINGS = [
  { id: 'pearl',    name: '珍珠',     color: '#2A1A12', price: 0.75 },
  { id: 'brown',    name: '黑糖珍珠', color: '#5B2E10', price: 0.90 },
  { id: 'coco',     name: '椰果',     color: '#F3EFE4', price: 0.75 },
  { id: 'taroball', name: '芋圆',     color: '#B49AD6', price: 1.00 },
  { id: 'pudding',  name: '布丁',     color: '#F2C14E', price: 1.00 },
  { id: 'cheese',   name: '芝士奶盖', color: '#FFF3D6', price: 1.25 },
];

/* 招牌饮品：每一杯都是"调一杯"里的一个预设组合。
   tags 用来给"今天喝什么"打分。 */
const DRINKS = [
  { name: '黑糖珍珠鲜奶', en: 'Brown Sugar Pearls Milk', short: '黑糖珍珠',
    preset: { tea: 'black', milk: 'milk', sweet: 70, ice: 'less', tops: ['brown'] }, tags: ['sweet', 'warmok', 'cozy'] },
  { name: '经典珍珠奶茶', en: 'Classic Bubble Milk Tea', short: '珍珠奶茶',
    preset: { tea: 'black', milk: 'milk', sweet: 50, ice: 'normal', tops: ['pearl'] }, tags: ['caffeine', 'warmok', 'classic'] },
  { name: '芋泥波波', en: 'Taro Paste Boba', short: '芋泥波波',
    preset: { tea: 'taro', milk: 'milk', sweet: 50, ice: 'less', tops: ['taroball', 'pearl'] }, tags: ['sweet', 'warmok', 'cozy'] },
  { name: '草莓椰椰', en: 'Strawberry Coconut', short: '草莓椰椰',
    preset: { tea: 'fruit', milk: 'none', sweet: 50, ice: 'normal', tops: ['coco'] }, tags: ['fruity', 'fresh'] },
  { name: '抹茶椰椰', en: 'Matcha Coconut', short: '抹茶椰椰',
    preset: { tea: 'matcha', milk: 'oat', sweet: 30, ice: 'normal', tops: ['coco'] }, tags: ['caffeine', 'fresh'] },
  { name: '泰式珍珠奶茶', en: 'Thai Milk Tea with Pearls', short: '泰式奶茶',
    preset: { tea: 'thai', milk: 'milk', sweet: 70, ice: 'normal', tops: ['pearl'] }, tags: ['caffeine', 'sweet'] },
  { name: '茉莉奶盖绿茶', en: 'Jasmine Cheese Foam', short: '茉莉奶盖',
    preset: { tea: 'jasmine', milk: 'none', sweet: 30, ice: 'less', tops: ['cheese'] }, tags: ['caffeine', 'fresh'] },
  { name: '乌龙布丁奶茶', en: 'Oolong Pudding Milk Tea', short: '乌龙布丁',
    preset: { tea: 'oolong', milk: 'milk', sweet: 50, ice: 'less', tops: ['pudding'] }, tags: ['caffeine', 'warmok', 'classic'] },
];