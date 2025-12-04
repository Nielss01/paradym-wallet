function request() {
  const actionRaw = ACTION || "{}";

  let action;
  try {
    action = JSON.parse(actionRaw);
  } catch (e) {
    throw new Error("Invalid ACTION JSON: " + actionRaw);
  }

  const scriptPath = WALLET_RELYING_PARTY_SCRIPT;
  if (!scriptPath) {
    throw new Error("WALLET_RELYING_PARTY_SCRIPT not set");
  }

  let result;

  if (scriptPath.includes("paradym")) {
    result = callParadymBackend(action);
  } else if (scriptPath.includes("playground")) {
    console.log("playground called")
    result = callPlaygroundBackend(action);
  } else {
    throw new Error("Unknown WALLET_RELYING_PARTY_SCRIPT: " + scriptPath);
  }

  if (!result || !result.deeplink) {
    throw new Error("Backend script did not return deeplink");
  }

  output.deeplink = result.deeplink;
  if (result.userPin) output.userPin = result.userPin;
  if (result.loginCode) output.loginCode = result.loginCode;

  return result;
}

output.request = request();

function callParadymBackend(action) {
  const body = JSON.stringify({
    credentialSupportedIds: [action.credentialId],
    authorization: action.authType,
    requireDpop: false,
    requireWalletAttestation: false,
    requireKeyAttestation: false
  });

  const response = http.post(PARADYM_REQUEST_URL, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": PARADYM_API_KEY
    },
    body
  });

  const data = json(response.body);
  if (!data || !data.issuanceSession) throw new Error("issuanceSession missing");

  const issuanceSession = data.issuanceSession;
  const uri =
    issuanceSession.credentialOfferUri ||
    issuanceSession.credential_offer_uri;
  if (!uri) throw new Error("credentialOfferUri missing in issuanceSession");

  const deeplink =
    "openid-credential-offer://?credential_offer_uri=" +
    encodeURIComponent(uri);

  return {
    deeplink,
    userPin: issuanceSession.userPin || null,
    loginCode: issuanceSession.authorization?.issuerState || null
  };
}

function callPlaygroundBackend(action) {
  const baseUrl = PLAYGROUND_URL || "https://playground.animo.id/api/";

  let request;

  if (action.action === "createOffer") {
    request = buildOfferRequest(baseUrl, action);
  } else if (action.action === "createVerification") {
    request = buildVerificationRequest(baseUrl, action);
  } else {
    throw new Error("Unsupported action: " + action.action);
  }

  const response = http.post(request.url, {
    headers: { "Content-Type": "application/json" },
    body: request.body,
  });

  const data = json(response.body);
  console.log(data)

  if (action.action === "createOffer") {
    return parseOfferResponse(data);
  }

  // createVerification
  return parseVerificationResponse(data);
}

// ========== REQUEST BUILDERS ==========

function buildOfferRequest(baseUrl, action) {
  return {
    url: baseUrl + "offers/create",
    body: JSON.stringify({
      credentialSupportedIds: [action.credential],
      authorization: action.authorization,
    }),
  };
}

function buildVerificationRequest(baseUrl) {
  return {
    url: baseUrl + "requests/create",
    body: JSON.stringify({
      presentationDefinitionId: "019368ed-3787-7669-b7f4-8c012238e90d__0",
      requestScheme: "openid4vp://",
      responseMode: "direct_post.jwt",
      requestSignerType: action.requestSignerType,
      transactionAuthorizationType: "none",
      version: action.version,
      queryLanguage: "dcql",
    }),
  };
}

// ========== RESPONSE PARSERS ==========

function parseOfferResponse(data) {
  if (!data.issuanceSession) throw new Error("issuanceSession missing");

  const session = data.issuanceSession;
  const uri = session.credentialOfferUri || session.credential_offer_uri;
  if (!uri) throw new Error("credentialOfferUri missing");

  const deeplink =
    "openid-credential-offer://?credential_offer_uri=" +
    encodeURIComponent(uri);

  return {
    type: "offer",
    deeplink,
    userPin: session.userPin || null,
    loginCode: session.authorization?.issuerState || null,
  };
}

function parseVerificationResponse(data) {
  if (!data) throw new Error("Empty verification response");

  const directUri =
    data.authorizationRequestUri || data.authorization_request_uri;

  if (directUri) {
    return {
      type: "verification",
      deeplink: directUri,
    };
  }

  const aro =
    data.authorizationRequestObject || data.authorization_request_object;

  if (!aro) {
    throw new Error(
      "authorizationRequestUri and authorizationRequestObject missing"
    );
  }

  const clientId = aro.client_id;
  const requestUri = aro.request_uri;

  if (!clientId || !requestUri) {
    throw new Error("client_id or request_uri missing in authorizationRequestObject");
  }

  const scheme = "openid4vp://";
  const verificationDeeplink =
    scheme +
    "?client_id=" +
    encodeURIComponent(clientId) +
    "&request_uri=" +
    encodeURIComponent(requestUri);

  return {
    type: "verification",
    deeplink: verificationDeeplink,
  };
}
