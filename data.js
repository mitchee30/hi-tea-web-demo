/* =========================================================
   data.js：所有数据
   以后换成真实菜单，只改这个文件就行。
   ========================================================= */

/* 茶底：top 是液面附近的颜色（浅），bottom 是杯底的颜色（深），
   两个颜色之间做渐变，看起来更像真的饮料。 */
const TEAS = [
  { id: 'black',   name: '红茶',     top: '#B5652B', bottom: '#5E2A0C', price: 5.50 },
  { id: 'oolong',  name: '乌龙',     top: '#D29447', bottom: '#8A4F17', price: 5.80 },
  { id: 'jasmine', name: '茉莉绿茶', top: '#E4D58A', bottom: '#A88F33', price: 5.50 },
  { id: 'matcha',  name: '抹茶',     top: '#A9CB87', bottom: '#4E7E3C', price: 6.50 },
  { id: 'taro',    name: '芋头',     top: '#CDB6EA', bottom: '#7D5DB0', price: 6.50 },
  { id: 'thai',    name: '泰式茶',   top: '#F6A85A', bottom: '#C45E1C', price: 5.80 },
  { id: 'fruit',   name: '水果茶',   top: '#FF9AA8', bottom: '#D9304F', price: 6.50 },
];

/* mix：奶的比例，越大颜色越浅越"奶" */
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

/* 小料：
   - light / dark 是立体渐变的高光色和阴影色
   - r 是半径（杯子坐标里的大小）
   - count 是放多少颗
   - zone：bottom 沉底，float 悬浮在中间，top 浮在液面（奶盖单独画） */
const TOPPINGS = [
  { id: 'pearl',    name: '珍珠',     light: '#6B4A3A', dark: '#120806', r: 8,  count: 18, zone: 'bottom', price: 0.75 },
  { id: 'brown',    name: '黑糖珍珠', light: '#C2742F', dark: '#3A1A06', r: 8,  count: 18, zone: 'bottom', price: 0.90 },
  { id: 'coco',     name: '椰果',     light: '#FFFFFF', dark: '#E6DEC8', r: 7,  count: 10, zone: 'float',  price: 0.75 },
  { id: 'taroball', name: '芋圆',     light: '#E7DAF7', dark: '#8C6BC2', r: 10, count: 8,  zone: 'bottom', price: 1.00 },
  { id: 'pudding',  name: '布丁',     light: '#FFE69A', dark: '#E0A12A', r: 22, count: 1,  zone: 'bottom', price: 1.00 },
  { id: 'cheese',   name: '芝士奶盖', light: '#FFFBEF', dark: '#F3DDA8', r: 0,  count: 0,  zone: 'top',    price: 1.25 },
];

/* 招牌饮品：每一杯都是一个固定配方。
   desc 显示在菜单卡片上；tags 用来给"今天喝什么"打分。 */
const DRINKS = [
  { id: 'brown-sugar', name: '黑糖珍珠鲜奶', en: 'Brown Sugar Pearls Milk', short: '黑糖珍珠',
    desc: '黑糖沿着杯壁挂出虎纹，珍珠现煮。',
    preset: { tea: 'black', milk: 'milk', sweet: 70, ice: 'less', size: 'M', tops: ['brown'] }, tags: ['sweet', 'warmok', 'cozy'] },
  { id: 'classic', name: '经典珍珠奶茶', en: 'Classic Bubble Milk Tea', short: '珍珠奶茶',
    desc: '红茶加鲜奶，最经典的那一杯。',
    preset: { tea: 'black', milk: 'milk', sweet: 50, ice: 'normal', size: 'M', tops: ['pearl'] }, tags: ['caffeine', 'warmok', 'classic'] },
  { id: 'taro', name: '芋泥波波', en: 'Taro Paste Boba', short: '芋泥波波',
    desc: '芋头鲜奶，芋圆和珍珠双份嚼感。',
    preset: { tea: 'taro', milk: 'milk', sweet: 50, ice: 'less', size: 'M', tops: ['taroball', 'pearl'] }, tags: ['sweet', 'warmok', 'cozy'] },
  { id: 'strawberry', name: '草莓椰椰', en: 'Strawberry Coconut', short: '草莓椰椰',
    desc: '酸甜果茶配椰果，夏天的味道。',
    preset: { tea: 'fruit', milk: 'none', sweet: 50, ice: 'normal', size: 'M', tops: ['coco'] }, tags: ['fruity', 'fresh'] },
  { id: 'matcha', name: '抹茶椰椰', en: 'Matcha Coconut', short: '抹茶椰椰',
    desc: '燕麦奶打底，抹茶微苦回甘。',
    preset: { tea: 'matcha', milk: 'oat', sweet: 30, ice: 'normal', size: 'M', tops: ['coco'] }, tags: ['caffeine', 'fresh'] },
  { id: 'thai', name: '泰式珍珠奶茶', en: 'Thai Milk Tea with Pearls', short: '泰式奶茶',
    desc: '橙色的泰式茶，香料味浓郁。',
    preset: { tea: 'thai', milk: 'milk', sweet: 70, ice: 'normal', size: 'M', tops: ['pearl'] }, tags: ['caffeine', 'sweet'] },
  { id: 'jasmine', name: '茉莉奶盖绿茶', en: 'Jasmine Cheese Foam', short: '茉莉奶盖',
    desc: '清爽绿茶，顶上一层咸甜奶盖。',
    preset: { tea: 'jasmine', milk: 'none', sweet: 30, ice: 'less', size: 'M', tops: ['cheese'] }, tags: ['caffeine', 'fresh'] },
  { id: 'oolong', name: '乌龙布丁奶茶', en: 'Oolong Pudding Milk Tea', short: '乌龙布丁',
    desc: '焙火乌龙配一整块滑嫩布丁。',
    preset: { tea: 'oolong', milk: 'milk', sweet: 50, ice: 'less', size: 'M', tops: ['pudding'] }, tags: ['caffeine', 'warmok', 'classic'] },
];

const MOODS = [
  { id: 'wake',  name: '要提神' },
  { id: 'sweet', name: '想吃甜的' },
  { id: 'fresh', name: '想清爽一点' },
  { id: 'any',   name: '随便，你定' },
];
