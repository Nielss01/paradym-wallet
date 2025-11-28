function getIssuanceData(authType, credentailId) {
  console.log("credentailId" , credentailId)
  const body = JSON.stringify({
    // mobile-drivers-license-mdoc
    //"arf-pid-sd-jwt"
    credentialSupportedIds: [credentailId],
    authorization: authType,
    requireDpop: false,
    requireWalletAttestation: false,
    requireKeyAttestation: false
  });

  const response = http.post(requestUrl, {
    headers: { "Content-Type": "application/json" },
    body: body
  });

  const data = json(response.body);

  if (!data || !data.issuanceSession) {
    throw new Error("issuanceSession missing");
  }

  const issuanceSession = data.issuanceSession;

  const uri =
    issuanceSession.credentialOfferUri ||
    issuanceSession.credential_offer_uri;

  if (!uri) {
    throw new Error("credentialOfferUri missing in issuanceSession");
  }

  const userPin = issuanceSession.userPin || null
  const loginCode = issuanceSession.authorization?.issuerState || null


  const deeplink =
    "openid-credential-offer://?credential_offer_uri=" +
    encodeURIComponent(uri);

  return {
    deeplink,
    userPin,
    loginCode
  };
}

const result = getIssuanceData(AUTH_TYPE, CREDENTIAL_ID);
output.deeplink = result.deeplink;

if (result.userPin) {
  output.userPin = result.userPin;
} else {
  console.log("No user PIN returned for authType:", AUTH_TYPE);
}

if(result.loginCode){
  output.loginCode = result.loginCode
  console.log("login code", output.loginCode)
}else{
  console.log("No user LOGIN returned for authType:", AUTH_TYPE);
}

