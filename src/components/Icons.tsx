import { GizmoType } from '../worker/WorkerTypes';

export function getComponentIcon(componentName) {
    return `img/Invention Components/${componentName.replace(' ', '_')}.png`;
};

export function getPerkIcon(perkName) {
    return `img/Invention Perk Icons/${perkName.replace(' ', '_')}.png`;
};

export function getPerkRankIcon(rank) {
    return `img/Invention Perk Rank Icons/Perk_rank_${rank}.png`;
}

export function getGizmoIcon(gizmoType, ancient) {
    switch (gizmoType) {
        case GizmoType.Weapon:
            return `img/Invention Gizmo Shells/${ancient ? "Ancient" : "Regular"}_weapon_gizmo_shell.png`;
        case GizmoType.Armour:
            return `img/Invention Gizmo Shells/${ancient ? "Ancient" : "Regular"}_armour_gizmo_shell.png`;
        case GizmoType.Tool:
            return `img/Invention Gizmo Shells/${ancient ? "Ancient" : "Regular"}_tool_gizmo_shell.png`;
        default:
            throw 'invalid gizmo type';
    }
}

/*
export const compList = ['Precious components', 'Precise components', 'Pious components',
    'Evasive components', 'Blade parts', 'Magic parts', 'Deflecting parts', 'Direct components',
    'Shadow components', 'Refined components', 'Resilient components',
    'Enhancing components', 'Ilujankan components', 'Simple parts',
    'Oceanic components', 'Fungal components', 'Heavy components',
    'Armadyl components', 'Flexible parts', 'Third-age components',
    'Cover parts', 'Junk', 'Spiritual parts', 'Cywir components',
    'Light components', 'Base parts', 'Plated parts', 'Swift components',
    'Saradomin components', 'Clear parts', 'Healthy components',
    'Smooth parts', 'Knightly components', 'Sharp components',
    'Protective components', 'Imbued components', 'Ethereal components',
    'Historic components', 'Subtle components', 'Fortunate components',
    'Bandos components', 'Vintage components', 'Living components',
    'Culinary components', 'Seren components', 'Ascended components',
    'Corporeal components', 'Crystal parts', 'Strong components',
    'Powerful components', 'Avernic components', 'Shifting components',
    'Organic parts', 'Dextrous components', 'Faceted components',
    'Pestiferous components', 'Variable components', 'Stave parts',
    'Zaros components', 'Silent components', 'Head parts',
    'Explosive components', 'Undead components', 'Stunning components',
    'Clockwork components', 'Spiked parts', 'Zamorak components',
    'Brassican components', 'Padded parts', 'Timeworn components',
    'Noxious components', 'Connector parts', 'Harnessed components',
    'Dragonfire components', 'Classic components', 'Delicate parts',
    'Rumbling components', 'Tensile parts', 'Crafted parts',
    'Metallic parts'];

export const perkList = ['Devoted', 'Rapid', 'Efficient', 'Hoarding',
    'Relentless', 'Reflexes', 'Genocidal', 'Tinker', 'Taunting', 'Fatiguing',
    'Mysterious', 'Wise', 'Junk Food', 'Equilibrium', 'Breakdown',
    'Flanking', 'Furnace', 'Inaccurate', 'Brief Respite', 'Blunted',
    'Caroming', 'Lucky', 'Lunging', 'Ruthless', 'Confused',
    "Trophy-taker's", 'Imp Souled', 'Enlightened', 'Turtling',
    'Undead Bait', 'Enhanced Efficient', 'Ultimatums', 'Fortune',
    'Cautious', 'Dragon Slayer', 'Looting', 'Profane', 'Bulwark',
    'Mobile', 'No effect', 'Scavenging', 'Impatient', 'Charitable',
    'Aftershock', 'Brassican', 'Glow Worm', 'Absorbative', 'Polishing',
    'Biting', 'Spendthrift', 'Shield Bashing', 'Demon Bait', 'Demon Slayer',
    'Precise', 'Clear Headed', 'Energising', 'Cheapskate', 'Undead Slayer',
    'Invigorating', 'Antitheism', 'Preparation', 'Venomblood', 'Planted Feet',
    'Honed', 'Pyromaniac', 'Talking', 'Mediocrity', 'Prosper', 'Butterfingers',
    'Committed', 'Crystal Shield', 'Hallucinogenic', 'Refined', 'Dragon Bait',
    'Enhanced Devoted', 'Crackling'];
*/