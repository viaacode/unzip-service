const AdmZip = require('adm-zip');
const fileUtils = require('./fileUtils');

function Unzipper (config, params) {
    this.config = config;
    this.params = params || {};
}

Unzipper.prototype.unzip = function(cb) {
    const fullPath = fileUtils.createFullPath(this.config.source_filepath, this.config.source_filename);
    const destinationPath = fileUtils.appendFolder(this.config.source_filepath, fileUtils.getFileNameWithoutExtension(this.config.source_filename, fileUtils.getExtension(this.config.source_filename)));
    const zip = new AdmZip(fullPath);
    console.log('Unzipping...');
    zip.extractAllTo( destinationPath, true);
    cb(null, {
        destination_path: destinationPath
    });
};

module.exports = Unzipper;