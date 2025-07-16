// Product catalog configuration
const PRODUCTS = {
    "lamb20kg": {
        name: "Lamb Meat Box 20KG",
        price: 2960.00,
        image: "🥩"
    },
    "lamb10kg": {
        name: "Lamb Meat Box 10KG",
        price: 1495.00,
        image: "🥩"
    },
    "lamb5kg": {
        name: "Lamb Meat Box 5KG",
        price: 760.00,
        image: "🥩"
    },
    "lamb2kg": {
        name: "Lamb Meat Box 2KG",
        price: 308.00,
        image: "🥩"
    },
    "lambribs2kg": {
        name: "Lamb Braai Ribs Box 2KG",
        price: 308.00,
        image: "🥩"
    },
    "lambtripe4kg": {
        name: "Lamb Tripe Set 4KG",
        price: 300.00,
        image: "🥩"
    },
    "lambtails2kg": {
        name: "Lamb Braai Tails 2KG",
        price: 280.00,
        image: "🥩"
    },
    "goat5kg": {
        name: "Goat Meat Box 5KG",
        price: 770.00,
        image: "🥩"
    },
    "goat2kg": {
        name: "Goat Meat Box 2KG",
        price: 319.00,
        image: "🥩"
    },
    "pork5kg": {
        name: "Pork Meat Box 5KG",
        price: 660.00,
        image: "🥩"
    },
    "pork2kg": {
        name: "Pork Meat Box 2KG",
        price: 275.00,
        image: "🥩"
    },
    "porkhead5kg": {
        name: "Pork Head Set 5-6KG",
        price: 300.00,
        image: "🥩"
    },
    "beefsteak5kg": {
        name: "Deluxe Beef Steak Box 5KG",
        price: 975.00,
        image: "🥩"
    },
    "beefstandard5kg": {
        name: "Beef Standard Box 5KG",
        price: 660.00,
        image: "🥩"
    },
    "beefmince2kg": {
        name: "Beef Mince Meat 2KG",
        price: 290.00,
        image: "🥩"
    },
    "beefbraaiwors": {
        name: "Beef Braai Wors 2KG",
        price: 330.00,
        image: "🥩"
    }
};

// Product display order for consistent numbering
const PRODUCT_ORDER = [
    "lamb20kg",
    "lamb10kg", 
    "lamb5kg",
    "lamb2kg",
    "lambribs2kg",
    "lambtripe4kg",
    "lambtails2kg",
    "goat5kg",
    "goat2kg",
    "pork5kg",
    "pork2kg",
    "porkhead5kg",
    "beefsteak5kg",
    "beefstandard5kg",
    "beefmince2kg",
    "beefbraaiwors"
];

// Discount codes configuration
const DISCOUNT_CODES = {
    'WELCOME10': 0.1,
    'SAVE20': 0.2,
    'FIRSTORDER': 0.15
};

module.exports = {
    PRODUCTS,
    PRODUCT_ORDER,
    DISCOUNT_CODES
};