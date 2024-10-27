const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');
const fs = require('fs');

const IP_FILE = 'ip.json';
const CONFIG_FILE = 'config.json';
const LEARNING_FILE = 'learning.json';

function loadFile(fileName) {
    if (fs.existsSync(fileName)) {
        const data = fs.readFileSync(fileName);
        return JSON.parse(data);
    } else {
        console.error(`Файл ${fileName} не найден. / File ${fileName} not found.`);
        process.exit(1);
    }
}

function saveLearningData(learningData) {
    fs.writeFileSync(LEARNING_FILE, JSON.stringify(learningData, null, 2));
}

function loadLearningData() {
    if (fs.existsSync(LEARNING_FILE)) {
        const data = fs.readFileSync(LEARNING_FILE);
        return JSON.parse(data);
    } else {
        return {};
    }
}

function main() {
    const ipConfig = loadFile(IP_FILE);
    const config = loadFile(CONFIG_FILE);
    const learningData = loadLearningData();

    for (let i = 1; i <= config.numberOfBots; i++) {
        createBot(i, ipConfig.host, ipConfig.port, ipConfig.version, config, learningData);
    }
}

function createBot(i, host, port, version, config, learningData) {
    const bot = mineflayer.createBot({
        host: host,
        port: port,
        username: `bot${i}`,
        version: version
    });

    bot.on('login', () => {
        console.log(`${bot.username} успешно подключился к серверу. / ${bot.username} has successfully connected to the server.`);
    });

    bot.on('spawn', () => {
        console.log(`${bot.username} заспаунился. / ${bot.username} spawned.`);
        bot.targetPosition = { x: config.targetX, y: config.targetY, z: config.targetZ };
    });

    bot.on('health', () => {
        checkHunger(bot);
        navigateToTarget(bot, config, learningData);
        followPlayer(bot, config);
    });

    bot.on('death', () => {
        console.log(`${bot.username} умер. / ${bot.username} died.`);
    });

    bot.on('error', (err) => {
        console.error(`Ошибка у ${bot.username}: ${err.message} / Error at ${bot.username}: ${err.message}`);
    });

    bot.on('end', () => {
        console.log('Бот пытается зайти, ожидайте 5 секунд... / Bot is trying to log in, expect 5 seconds...');
        respawnBot(i, host, port, version, config, learningData);
    });

    setInterval(() => {
        checkHunger(bot);
        navigateToTarget(bot, config, learningData);
        followPlayer(bot, config);
    }, 1000);
}

function respawnBot(i, host, port, version, config, learningData) {
    setTimeout(() => createBot(i, host, port, version, config, learningData), 5000);
}

function navigateToTarget(bot, config, learningData) {
    if (!bot.entity || !bot.entity.position || !bot.targetPosition) return;

    const pos = bot.entity.position;
    const target = bot.targetPosition;
    const distance = pos.distanceTo(new Vec3(target.x, target.y, target.z));

    if (distance > 1) {
        const direction = new Vec3(target.x - pos.x, target.y - pos.y, target.z - pos.z).normalize();
        bot.setControlState('forward', true);
        bot.lookAt(new Vec3(target.x, target.y, target.z));
        logMovementExperience(bot, learningData, pos, direction);
    } else {
        bot.setControlState('forward', false);
        console.log(`${bot.username} достиг цели. / ${bot.username} has achieved its goal.`);
        bot.targetPosition = { x: Math.random() * 100, y: pos.y, z: Math.random() * 100 };
    }
}

function followPlayer(bot, config) {
    if (!bot.entity || !bot.entity.position) return;

    const player = bot.players[config.playerName];
    if (player && player.entity) {
        const distance = bot.entity.position.distanceTo(player.entity.position);

        if (distance <= config.followRadius && distance > config.minDistance) {
            bot.setControlState('forward', true);
            bot.setControlState('jump', bot.entity.isCollidedHorizontally);
            bot.lookAt(player.entity.position.offset(0, 1.6, 0));
        } else {
            bot.setControlState('forward', false);
            bot.setControlState('jump', false);
        }
    } else {
        bot.setControlState('forward', false);
        bot.setControlState('jump', false);
    }
}

function logMovementExperience(bot, learningData, pos, direction) {
    if (!learningData.movements) {
        learningData.movements = [];
    }

    learningData.movements.push({
        username: bot.username,
        position: { x: pos.x, y: pos.y, z: pos.z },
        direction: { x: direction.x, y: direction.y, z: direction.z },
        timestamp: Date.now()
    });

    saveLearningData(learningData);
}

function checkHunger(bot) {
    if (bot.food === 0) {
        bot.chat("Мне нужна еда! / I need food!");
    }
}

main();
