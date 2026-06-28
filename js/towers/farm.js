// js/towers/farm.js
import { GameEngine } from '../engine.js';
import { Utils } from '../utils.js';

export default {
    stats: { 
        name: "Banana Farm", cost: 1250, range: 40, fireRate: 0, damage: 0, pierce: 0, projectileSpeed: 0, 
        lifespan: 0, desc: "Produces bananas that give extra cash.", dmgType: 'none', hitRadius: 18, 
        isStaticRotation: true,
        bananaCount: 4, bananaLifespan: 15, bananaValue: 20, bananaValueMult: 0,
        bankCap: 7000, bankIncome: 180,
        collectionRange: 40 // NEW: Base magnetic collection range
    },
    upgrades: {
        1: [
            {name:"Increased Production", cost:500, stat:"bananaCount", amount:6, desc:"Produces 6 bananas per round."},
            {name:"Greater Production", cost:600, stat:"bananaCount", amount:8, desc:"Produces 8 bananas per round."},
            {name:"Banana Plantation", cost:3000, stat:"bananaCount", amount:16, desc:"Produces 16 bananas per round."},
            {name:"Banana Research Facility", cost:19000, stat:"bananaCount", amount:5, desc:"Produces 5 crates worth $300 each.", extraMods:{bananaValue:300, isCrate:true}},
            {name:"Banana Central", cost:115000, stat:"bananaValue", amount:1200, desc:"Produces 5 giant crates worth $1200 each."}
        ],
        2: [
            {name:"Long Life Bananas", cost:300, stat:"bananaLifespan", amount:30, desc:"Bananas last 30 seconds instead of 15."},
            {name:"Valuable Bananas", cost:800, stat:"bananaValueMult", amount:0.25, desc:"Bananas are worth 25% more cash."},
            {name:"Monkey Bank", cost:3650, stat:"isBank", amount:true, desc:"Stores cash in a bank account with 15% interest. Capacity $7000."},
            {name:"IMF Loan", cost:7200, stat:"bankCap", amount:10000, desc:"Bank capacity increased to $10,000. Unlocks IMF Loan ability.", extraMods:{unlocksAbility:true, abilityName:"IMF Loan", abilityCd:60}},
            {name:"Monkey-Nomics", cost:100000, stat:"isBank", amount:true, desc:"Unlocks Monkey-Nomics ability for free cash.", extraMods:{unlocksAbility:true, abilityName:"Monkey-Nomics", abilityCd:60}}
        ],
        3: [
            {name:"EZ Collect", cost:250, stat:"collectionRange", amount:40, desc:"Collection radius increased to 80. Auto-collects expired bananas for 50% value."},
            {name:"Banana Salvage", cost:400, stat:"bananaSalvage", amount:0.85, desc:"Auto-collects expired bananas for 85% value. Increases resale value by 10%."},
            {name:"Marketplace", cost:2700, stat:"isMarket", amount:true, desc:"Automatically adds $20 to wallet 16 times per round.", extraMods:{bananaValue:20}},
            {name:"Central Market", cost:15000, stat:"bananaValue", amount:70, desc:"Automatically adds $70 to wallet 16 times per round."},
            {name:"Monkey Wall Street", cost:70000, stat:"wallStreet", amount:true, desc:"Generates $4000 and 15 lives at the end of each round. Auto-collects nearby bananas."}
        ]
    },
    
    update(tower, dt) {
        if (!tower.bananas) tower.bananas = [];
        if (!tower.bankBalance) tower.bankBalance = 0;
        if (!tower.abilityUsesThisRound) tower.abilityUsesThisRound = 0;
        
        // Banana Central Global Buff
        if (tower.upgrades[0] === 5 && !tower._buffApplied) {
            for (let ot of GameEngine.towers) {
                if (ot && ot.type === 'farm' && ot.upgrades[0] === 4) {
                    ot.stats.bananaValueMult = (ot.stats.bananaValueMult || 0) + 0.25;
                }
            }
            tower._buffApplied = true;
        }

        // Dynamic Crosspath Math
        let path1 = tower.upgrades[0];
        let path2 = tower.upgrades[1];
        let path3 = tower.upgrades[2];

        let spawnsPerRound = 4;
        if (path3 >= 3) { // Market/Central
            spawnsPerRound = 16;
            if (path1 === 1) spawnsPerRound = 18;
            if (path1 >= 2) spawnsPerRound = 20;
        } else if (path2 >= 3) { // Bank
            spawnsPerRound = 6;
            if (path1 === 1) spawnsPerRound = 7;
            if (path1 >= 2) spawnsPerRound = 8;
        } else { // Base Farm
            if (path1 === 1) spawnsPerRound = 6;
            if (path1 === 2) spawnsPerRound = 8;
            if (path1 === 3) spawnsPerRound = 16;
            if (path1 >= 4) spawnsPerRound = 5; // Crates
        }

        // Wave Start Detection
        if (!tower._waveActive && GameEngine.waveManager.waveActive) {
            tower._waveActive = true;
            tower.spawnsLeft = spawnsPerRound;
            tower.spawnTimer = 0;
            
            // PRO FIX: Reset IMF/Monkey-Nomics cooldown to 100% at round start
            if (tower.stats.isAbility && path2 >= 4) {
                tower.abilityCooldown = tower.stats.abilityCd || 60;
                tower.abilityUsesThisRound = 0;
            }
        } else if (tower._waveActive && !GameEngine.waveManager.waveActive) {
            tower._waveActive = false;
            // Burst spawn remaining if round ended early
            while (tower.spawnsLeft > 0) {
                if (tower.stats.isBank) {
                    let income = (tower.stats.bankIncome || 180) / 6;
                    let mult = 1 + (tower.stats.bananaValueMult || 0);
                    let cap = tower.stats.bankCap || 7000;
                    tower.bankBalance = Math.min(cap, tower.bankBalance + (income * mult));
                } else if (tower.stats.isMarket) {
                    let val = tower.stats.bananaValue || 20;
                    let mult = 1 + (tower.stats.bananaValueMult || 0);
                    GameEngine.addCash(Math.floor(val * mult));
                } else {
                    this.spawnBanana(tower);
                }
                tower.spawnsLeft--;
            }
        }

        if (tower._waveActive && tower.spawnsLeft > 0) {
            tower.spawnTimer += dt;
            let interval = 15.0 / spawnsPerRound;
            
            if (tower.spawnTimer >= interval) {
                tower.spawnTimer = 0;
                
                if (tower.stats.isBank) {
                    let income = (tower.stats.bankIncome || 180) / 6;
                    let mult = 1 + (tower.stats.bananaValueMult || 0);
                    let cap = tower.stats.bankCap || 7000;
                    tower.bankBalance = Math.min(cap, tower.bankBalance + (income * mult));
                } else if (tower.stats.isMarket) {
                    let val = tower.stats.bananaValue || 20;
                    let mult = 1 + (tower.stats.bananaValueMult || 0);
                    GameEngine.addCash(Math.floor(val * mult));
                } else {
                    this.spawnBanana(tower);
                }
                tower.spawnsLeft--;
            }
        }

        // Update physical bananas
        for (let i = tower.bananas.length - 1; i >= 0; i--) {
            let b = tower.bananas[i];
            b.life -= dt;
            
            if (b.progress < 1) {
                b.progress += dt / 0.6;
                if (b.progress > 1) b.progress = 1;
                b.x = Utils.lerp(b.startX, b.targetX, b.progress);
                b.y = Utils.lerp(b.startY, b.targetY, b.progress);
                b.arc = Math.sin(b.progress * Math.PI) * 20; 
            }

            // Monkey Wall Street auto-collect
            if (tower.stats.wallStreet) {
                if (Utils.distance(tower.x, tower.y, b.x, b.y) < 75) {
                    GameEngine.addCash(b.value);
                    tower.bananas.splice(i, 1);
                    continue;
                }
            }

            if (b.life <= 0) {
                let salvage = tower.stats.bananaSalvage || 0;
                if (tower.upgrades[2] >= 1 && salvage === 0) salvage = 0.5; // EZ Collect
                if (salvage > 0) GameEngine.addCash(Math.floor(b.value * salvage));
                tower.bananas.splice(i, 1);
            }
        }
    },

    spawnBanana(tower) {
        let angle = Math.random() * Math.PI * 2;
        let dist = 10 + Math.random() * 30; // Spawns within 40px
        let targetX = tower.x + Math.cos(angle) * dist;
        let targetY = tower.y + Math.sin(angle) * dist;
        
        let baseValue = 20;
        if (tower.upgrades[0] === 4) baseValue = 300;
        if (tower.upgrades[0] === 5) baseValue = 1200;
        let mult = 1 + (tower.stats.bananaValueMult || 0);
        
        tower.bananas.push({
            startX: tower.x, startY: tower.y, targetX, targetY,
            x: tower.x, y: tower.y, arc: 0, progress: 0,
            life: tower.stats.bananaLifespan || 15,
            maxLife: tower.stats.bananaLifespan || 15,
            value: Math.floor(baseValue * mult),
            isCrate: tower.stats.isCrate || false
        });
    },

    ability(tower, engine) {
        // Max 2 uses per round
        if (tower.abilityUsesThisRound >= 2) {
            engine.log("Ability locked: Max uses per round reached.");
            return;
        }

        if (tower.upgrades[1] === 5) {
            engine.addCash(9000);
            engine.log("Monkey-Nomics Activated! +$9000");
        } else {
            engine.addCash(9000);
            engine.imfDebt += 9000;
            engine.log("IMF Loan Activated! +$9000 (Taxed at 50%)");
        }
        tower.abilityUsesThisRound++;
    },

    draw(ctx, tower, isPreview) {
        // PRO FIX: Call drawBaseTower so the sprite actually renders!
        tower.drawBaseTower(ctx, isPreview);

        // Draw Bank Balance Text
        if (tower.stats.isBank && !isPreview) {
            ctx.fillStyle = tower.bankBalance >= (tower.stats.bankCap || 7000) ? '#f1c40f' : '#ffffff';
            ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
            ctx.fillText(`$${Math.floor(tower.bankBalance)}`, tower.x, tower.y - 25);
        }
    }
};