var csv = require('csv-parser');
var fse = require('fs-extra');
var path = require('path');
var followRedirects = require('follow-redirects');
const moment = require('moment');

followRedirects.maxRedirects = 10;
var https = followRedirects.https;

var sheets = JSON.parse(fse.readFileSync('sheets.json'));

function editLinkToCsvLink(url) {
    const editPostfixes = [ 'edit#gid=0', 'edit?usp=sharing' ];
    let newUrl = url;
    for (const editPostfix of editPostfixes) {
        newUrl = newUrl.replace(editPostfix, 'export?format=csv');
    }
    return newUrl;
}

function rowFileName(rowData, headers) {
    let fileName = rowData[headers[0]];
    const exclusions = [ 'HL7 Data Type - FHIR R4: ', 'HL7 Segment - FHIR R4: ', 'HL7 Message - FHIR R4: ' ];
    const replacements = [ '/', ':', ' ' ];
    for (let exclusion of exclusions) {
        fileName = fileName.replace(exclusion, '');
    }
    for (let replacement of replacements) {
        fileName = fileName.replace(replacement, '_');
    }
    return fileName;
}

(function main () {
    const rootFolder = path.join('./out', moment().format('YYYY-MM-DD_HH-mm-SS'));

    sheets["sheets"].forEach(s => {
        const destFolder = path.join(rootFolder, s.name);
        fse.ensureDirSync(destFolder);
    
        https.get(s.url, function (response) {
            var headers;
            response.pipe(csv())
                .on('headers', (h) => {
                    headers = h;
                })
                .on('data', (data) => {
                    try {
                        https.get(editLinkToCsvLink(data.Link), function(sheetResponse) {
                            if (sheetResponse.statusCode == 200) {
                                const filePath = path.join(destFolder, rowFileName(data, headers) + ".csv");
                                var file = fse.createWriteStream(filePath);
                                sheetResponse.pipe(file);
                            } else {
                                console.log('Error accessing file for ' + rowFileName(data, headers) + ', ' + editLinkToCsvLink(data.Link));
                            }
                        });
                    }
                    catch(err) {
                        console.log(`Error : [${err}] for ${rowFileName(data, headers)},  ${editLinkToCsvLink(data.Link)}`);
                    }
                });
        });
    });
})();
