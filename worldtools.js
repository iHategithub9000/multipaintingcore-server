const fs = require('fs');
const path = require('path');

function worldExists(name) {
    const filePath = path.join(__dirname, `${name}.json`);
    return fs.existsSync(filePath);
}

function generateWorld(x, y, name) {
    console.log("[worldgen] generating world"); 
    const world = [];
    for (let i = 0; i < y; i++) {
      const row = new Array(x).fill(0);
      world.push(row);
    }
    world.push({size:[x,y]})
    console.log("[worldgen] writing file")
    const jsonWorld = JSON.stringify(world);
    fs.writeFileSync(name+'.json', jsonWorld);
    console.log("[worldgen] generated world into "+name+'.json'); 
}

function getCell(world, x, y) {
    if (y >= world.length || x >= world[0].length || y < 0 || x < 0) {
        throw new Error("Invalid coordinates!");
    }
    return world[y][x];
}

function getWorld(name) {
    const filePath = path.join(__dirname, `${name}.json`);
    try {
        if (!fs.existsSync(filePath)) {
            throw new Error("World file not found!");
        }
        const world = require(filePath);
        return world;
    } catch (err) {
        throw new Error("Invalid world: " + err.message);
    }
}

function updateWorld(name, world) {
    const filePath = path.join(__dirname, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(world, null, 2));
}

function setCell(world, x, y, value) {
    if (y >= world.length || x >= world[0].length || y < 0 || x < 0) {
        throw new Error("Invalid coordinates!");
    }
    world[y][x] = value;
    return world;
}
module.exports = {
    worldExists,
    generateWorld,
    getCell,
    getWorld,
    updateWorld,
    setCell,
};