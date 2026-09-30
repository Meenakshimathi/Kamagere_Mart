/**
 * OPTIONAL FRONTEND BACKEND ADAPTER
 * Deploy as a Google Apps Script Web App.
 *
 * Replace the spreadsheet ID and sheet names with your own.
 * Do not store payment secrets or service-account credentials in frontend code.
 */

const SPREADSHEET_ID = 'REPLACE_WITH_YOUR_GOOGLE_SHEET_ID';

function doGet(e) {
  const action = e?.parameter?.action || 'health';
  if (action === 'health') return json({ok:true,service:'Kamagere Mart API'});
  if (action === 'products') return json(getProducts());
  return json({ok:false,error:'Unknown action'});
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    switch(body.action){
      case 'createOrder': return json(createOrder(body));
      case 'register': return json(register(body));
      default: return json({ok:false,error:'Unknown action'});
    }
  } catch(err) {
    return json({ok:false,error:String(err)});
  }
}

function getProducts(){
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Products');
  const values = sheet.getDataRange().getValues();
  if(values.length < 2) return [];
  const headers = values.shift();
  return values.map(row => Object.fromEntries(headers.map((h,i)=>[h,row[i]])));
}

function createOrder(body){
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Orders');
  sheet.appendRow([
    new Date(), body.orderId || '', body.customer || '', body.phone || '',
    JSON.stringify(body.items || []), body.total || 0,
    body.address || '', body.payment || 'COD', 'Confirmed'
  ]);
  return {ok:true,orderId:body.orderId};
}

function register(body){
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Customers');
  sheet.appendRow([new Date(),body.name||'',body.email||'',body.phone||'',body.address||'']);
  return {ok:true};
}

function json(data){
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
