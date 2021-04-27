const csv = require('csv-parser');
const fse = require('fs-extra');
const path = require('path');
const followRedirects = require('follow-redirects');
const moment = require('moment');

followRedirects.maxRedirects = 10;
const https = followRedirects.https;
const sheets = JSON.parse(fse.readFileSync('sheets.json'));

const editLinkToCsvLink = url => {
    const editPostfixes = [ 'edit#gid=0', 'edit?usp=sharing' ];
    let newUrl = url;
    for (const editPostfix of editPostfixes) {
        newUrl = newUrl.replace(editPostfix, 'export?format=csv');
    }
    return newUrl;
};

const rowFileName = (rowData, headers) => {
    let fileName = rowData[headers[0]];
    if (!fileName) {
        return '';
    }

    const exclusions = [
        'HL7 Data Type - FHIR R4: ',
        'HL7 Segment - FHIR R4: ',
        'HL7 Message - FHIR R4: '
    ];
    for (let exclusion of exclusions) {
        fileName = fileName.replace(exclusion, '');
    }

    return fileName.replace(/\/|\:|\s+/g, '_');
};

const main = () => {
    const rootFolder = path.join('./out', moment().format('YYYY-MM-DD_HH-mm-SS'));

    sheets["sheets"].forEach(s => {
        // The [0, 0] cell will be the key of file name in data line.
        // Sometimes it will be empty, so we use a more fixed source as headers[0].
        const csvParser = csv({
            mapHeaders: ({ header, index }) => index <= 0 ? s.name : header
        });
        const destFolder = path.join(rootFolder, s.name.replace(/ /g, ''));
        fse.ensureDirSync(destFolder);
    
        https.get(s.url, response => {
            let headers;
            response.pipe(csvParser)
                .on('headers', h => {
                    headers = h;
                    headers[0] = s.name;
                })
                .on('data', data => {
                    try {
                        https.get(editLinkToCsvLink(data.Link), sheetResponse => {
                            if (sheetResponse.statusCode == 200) {
                                const filePath = path.join(destFolder, rowFileName(data, headers) + ".csv");
                                const file = fse.createWriteStream(filePath);
                                sheetResponse.pipe(file);
                            }
                            else {
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
};

main();
