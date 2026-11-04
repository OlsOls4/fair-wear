// SAM 3.1 concept prompts used for the simulated demo flat (one request per concept; label = guidance key).
export const CONCEPTS: Record<string, [string, string][]> = {
  bedroom: [["wall", "wall"], ["beige carpet", "carpet"], ["curtain", "curtains"], ["wardrobe", "wardrobe"]],
  "living-room": [["wall", "wall"], ["grey carpet", "carpet"], ["curtain", "curtains"]],
  kitchen: [["wooden worktop", "worktop"], ["oven", "oven"], ["hob", "hob"], ["sink", "sink"]],
  bathroom: [["bathtub", "bath"], ["glass shower screen", "shower screen"], ["toilet", "toilet"], ["white sealant strip along the bath", "sealant"]],
};
