// categories.js — loaded as Babel script, exposes BS.categories
BS.CATEGORIES = [
  'Food & Grocery',
  'Electronics',
  'Clothing & Apparel',
  'Health & Beauty',
  'Home & Garden',
  'Dining & Restaurants',
  'Fuel & Transport',
  'Other',
];

BS.CATEGORY_COLORS = {
  'Food & Grocery':       '#10b981',
  'Electronics':          '#3b82f6',
  'Clothing & Apparel':   '#a855f7',
  'Health & Beauty':      '#ec4899',
  'Home & Garden':        '#f59e0b',
  'Dining & Restaurants': '#f97316',
  'Fuel & Transport':     '#64748b',
  'Other':                '#475569',
};

const _KEYWORDS = {
  'Food & Grocery':  ['milk','bread','rice','eggs','butter','cheese','fruit','vegetable','chicken','beef','pork','fish','pasta','cereal','juice','water','soda','sugar','salt','flour','oil','yogurt','cream','snack','chips','biscuit','cookie','chocolate','candy','tea','coffee','grocery','supermarket','produce','organic','fresh','frozen','canned','sauce','ketchup','spice'],
  'Electronics':     ['phone','laptop','tablet','computer','monitor','keyboard','mouse','cable','charger','battery','headphone','earphone','speaker','camera','tv','television','printer','router','usb','hdmi','adapter','hard drive','ssd','ram','console','gaming'],
  'Clothing & Apparel': ['shirt','pant','trouser','jeans','dress','skirt','blouse','jacket','coat','sweater','hoodie','shoes','sandal','boot','sneaker','socks','underwear','hat','cap','scarf','glove','belt','wallet','bag','handbag','clothing','apparel','fashion'],
  'Health & Beauty': ['medicine','tablet','capsule','syrup','vitamin','supplement','cream','lotion','shampoo','conditioner','soap','toothpaste','toothbrush','deodorant','perfume','makeup','lipstick','moisturizer','sunscreen','bandage','pharmacy','health','beauty','cosmetic'],
  'Home & Garden':   ['furniture','chair','table','bed','sofa','lamp','light','bulb','curtain','pillow','blanket','towel','mat','rug','cleaner','detergent','bleach','mop','broom','plant','pot','garden','tool','drill','hammer','paint'],
  'Dining & Restaurants': ['restaurant','cafe','pizza','burger','sandwich','sushi','noodle','curry','biryani','salad','soup','meal','lunch','dinner','breakfast','dessert','ice cream','bakery','dine','food court','delivery','takeaway'],
  'Fuel & Transport': ['petrol','diesel','fuel','gas','gasoline','parking','toll','taxi','uber','bus','train','metro','airline','flight','ticket','fare','transport','tyre','tire'],
};

BS.inferCategory = function(itemName) {
  if (!itemName) return 'Other';
  const lower = itemName.toLowerCase();
  for (const [cat, words] of Object.entries(_KEYWORDS)) {
    if (words.some(w => lower.includes(w))) return cat;
  }
  return 'Other';
};
