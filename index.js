const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
let jsonData = require('./config.json');

const token = jsonData.bot_token;

const bot = new TelegramBot(token, {polling: true});


let db = new sqlite3.Database('./users.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the database.');
});


let keyboards = {
    auth: {
        inline_keyboard: [
            [
                {
                    text: "Создать профиль",
                    callback_data: "create_profile"
                },
                {
                    text: "Авторизоваться", 
                    callback_data: "auth_profile"
                }
            ], 
            [
                {
                    text: 'Помощь',
                    callback_data: 'help'
                }
            ]
        ]
    }, 
    profile: {
        inline_keyboard: [
            [
                {
                    text: 'Профиль', 
                    callback_data: 'profile'
                }, 
                {
                    text: 'Мои чаты', 
                    callback_data: 'chats'
                }
            ], 
            [
                {
                    text: 'Вступить в диалог', 
                    callback_data: 'enter_chat'
                }
            ]
        ]
    }, 
    back_menu: {
        inline_keyboard: [
            [
                {
                    text: 'Назад', 
                    callback_data: 'back_menu'
                }
            ]
        ]
    }
}

function addUser(user_id) {    
    db.run("insert into user_info (telegram_id, username, password, media_status, link_status, last_activity, count_messages, mute_status) values (" + user_id + ", 'None', 'None', 'Запрещено', 'Запрещено', 'None', 0, 'Не замучен')");
}


function updatelevel(user_id, level, array) {
    for (let i = 0; i < array.length; i++) {
        let index = array[i].indexOf(user_id)
        if (index !== -1) {
            array.splice(index, 1)
            array.push([user_id, level])
        }
    }
}

function deleteLevel(user_id, array) {
    for (let i = 0; i < array.length; i++) {
        let index = array[i].indexOf(user_id)
        if (index !== -1) {
            array.splice(index, 1)
        }
    }
}

function isUserExits(user_id, id) {
    let sql = "SELECT * from user_info where telegram_id = '" + user_id + "'";
    db.get(sql, (err, rows) => {
        if (rows === null || rows === undefined){
            addUser(user_id)
            bot.sendMessage(id, '🤖Для общения нужно установить логин и пароль для аккаунта', {reply_markup: keyboards.auth});
        } else if (rows != null && err === null) {
            let sql = "SELECT * from user_info where telegram_id = '" + user_id + "'";
            db.get(sql, (err, rows) => {
                if (rows.username == 'None' && rows.password == 'None') {
                    bot.sendMessage(id, 'Пароль и логин не установлен', {reply_markup: keyboards.auth})
                } else if (rows.username == 'None') {
                    bot.sendMessage(id, 'Логин не установлен, /setlogin [username]')
                } else if (rows.password == 'None') {
                    bot.sendMessage(id, 'Пароль не установлен\nУстановить пароль командой /password (password), сменить - /changepassowrd (Last password) (New Password)')
                } else if (rows.password !== 'None' && rows.username !== 'None') {
                    bot.sendMessage(id, 'Привет', {reply_markup: keyboards.profile})
                }
            })
        }
    });
}


let registerlevel = []

bot.on('message', async (msg) => {
    console.log(msg)
    let id = msg.from.id
    if (msg.text) {
        if (msg.text == '/start') {
            isUserExits(id, id)
        }
        let object_register = Object.fromEntries(registerlevel)
        if (object_register[id] == 1) {
            if (msg.text.length > 3) {
                let sql = "SELECT * from user_info where username = '" + msg.text + "'";
                db.get(sql, (err, rows) => {
                    if (rows == null && err == null) {
                        db.run('update user_info set username = "' + msg.text + '" where telegram_id = "' + id + '"')
                        bot.sendMessage(id, 'Хорошо, придумайте пароль, так же не менее 3-ех символов!')
                        updatelevel(id, '2', registerlevel)
                    } else {
                        bot.sendMessage(id, 'Данный логин уже занят! Попробуйте придумать другой')
                        deleteLevel(id, registerlevel)
                        updatelevel(id, '1', registerlevel)
                    }
                })
            } else {
                bot.sendMessage(id, 'Меньше 3-ех символов, попробуйте еще раз!')
                deleteLevel(id, registerlevel)
                updatelevel(id, '1', registerlevel)
            }
        }
        if (object_register[id] == 2) {
            if (msg.text.length > 3) {
                db.run('update user_info set password = "' + msg.text + '" where telegram_id = "' + id + '"')
                deleteLevel(id, registerlevel)
                bot.sendMessage(id, 'Ты успешно зарегистрировался!', {reply_markup: keyboards.profile})
            } else {
                bot.sendMessage(id, 'Меньше 3-ех символов, попробуйте еще раз!')
                deleteLevel(id, registerlevel)
                updatelevel(id, '2', registerlevel)
            }
        }
        if (msg.text.length > 1) {
            db.run('update user_info set last_activity = Date("now") where telegram_id = "' + id + '"')
            let sql = "SELECT * from user_info where telegram_id = '" + id + "'";
            db.get(sql, (err, rows) => {
                if (rows == null && err == null) {
                    bot.sendMessage(id, 'Ошибка, не могу найти профиль!')
                } else {
                    db.run('update user_info set count_messages = ' + (rows.count_messages + 1)  + ' where telegram_id = "' + id + '"')
                }
            })
        }
    }
});
  
bot.on("polling_error", console.log);
  
bot.on('callback_query', (query) => { 
    let id = query.message.chat.id;
    console.log(query)
    switch (query.data) 
    {
        case 'create_profile':
            bot.sendMessage(id, 'Хорошо, придумай логин и напиши его мне, не менее 3-ех символов!')
            registerlevel.push([id, '1'])
            break
        case 'profile':
            let sql = "SELECT * from user_info where telegram_id = '" + id + "'";
            db.get(sql, (err, rows) => {
                if (rows == null && err == null) {
                    bot.sendMessage(id, 'Такого пользователя не существует!')
                } else {
                    bot.sendMessage(id, 'Profile [' + rows.username + ']\nВсего сообщений: ' + rows.count_messages + '\nПоследняя активность: ' + rows.last_activity + '\nСтатус мута: ' + rows.mute_status, {reply_markup: keyboards.back_menu})    
                }
            })
            break
        case 'back_menu': 
            bot.sendMessage(id, 'Menu:', {reply_markup: keyboards.profile})
            break
    } 
})