/*
 this module attempts to capture the process to create database elements, import
 initial datasets, then migrate those db elements and datasets over time.

 it is not foolproof. beware.
 */
const dbPath = '../database';
const fs = require('fs'); //uses process.cwd() as root for relative paths
const path = require("path"); //needed to use paths relative to this file's location
const db = require(`${dbPath}/db_postgres`);
const query = db.query;
const pgUtil = require(`${dbPath}/db_pgutil`);
const sqlCreateUserDb = fs.readFileSync(path.resolve(__dirname, 'create_user_db_ents.sql')).toString();
//const sqlAlterUserDb01 = fs.readFileSync(path.resolve(__dirname, 'alter_user_db_01.sql')).toString();
//const sqlImportUserCsv = fs.readFileSync(path.resolve(__dirname, 'import_users.sql')).toString();

module.exports = {
    createUserDb,
    importCSV,
    alterUserDb
};

function createUserDb() {
  return query(sqlCreateUserDb);
}

async function alterUserDb() {
  return query(sqlAlterUserDb01);
}

function importCSV(csvFileName='users.20190520.csv') {
    const qtext = `${sqlVpUserImportCsv} FROM '${path.resolve(__dirname, csvFileName)}' DELIMITER ',' CSV HEADER;`;
    console.log('users.model.importCSV | query:', qtext);
    query(qtext)
      .then(res => {
          console.log(`users.service.importCSV() | res:`, res);
          return res;
      })
      .catch(err => {
          console.log(`users.service.importCSV() | err:`, err.message);
          throw err;
      });
}
