const fs = require('fs');
module.exports = {
    checkban:function(r){
        const data = fs.readFileSync('bans.dat', 'utf8');
        return data.includes(r)
    },
    ban:function(r){
        fs.appendFileSync('bans.dat', r + '\n', 'utf8');
    }
}