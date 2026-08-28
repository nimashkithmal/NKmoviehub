/** Collection shelf categories for the public Collections page */
const COLLECTION_CATEGORIES = [
  { id: 'superhero_action', label: 'Superhero / Action' },
  { id: 'fantasy_adventure', label: 'Fantasy / Adventure' },
  { id: 'sci_fi', label: 'Sci-Fi' },
  { id: 'action_franchises', label: 'Action Franchises' },
  { id: 'horror_thriller', label: 'Horror / Thriller' }
];

const CATEGORY_IDS = COLLECTION_CATEGORIES.map((c) => c.id);

const CATEGORY_BY_SLUG = {
  'marvel-cinematic-universe': 'superhero_action',
  'dc-universe': 'superhero_action',
  'x-men': 'superhero_action',
  'spider-man': 'superhero_action',
  'the-dark-knight-trilogy': 'superhero_action',
  'harry-potter': 'fantasy_adventure',
  'middle-earth': 'fantasy_adventure',
  'the-chronicles-of-narnia': 'fantasy_adventure',
  'fantastic-beasts': 'fantasy_adventure',
  'transformers': 'sci_fi',
  'pirates-of-the-caribbean': 'action_franchises'
};

const getCategoryLabel = (id) =>
  COLLECTION_CATEGORIES.find((c) => c.id === id)?.label || 'Other';

module.exports = {
  COLLECTION_CATEGORIES,
  CATEGORY_IDS,
  CATEGORY_BY_SLUG,
  getCategoryLabel
};
