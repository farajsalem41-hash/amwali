#!/usr/bin/env python3
"""Creates demo data for local QA / screenshots. Never run against production."""
import json
import os
import random
import sys
import urllib.error
import urllib.request

API = os.environ.get("AMWALI_API", "http://localhost:5000/api")
PASSWORD = os.environ.get("DEMO_PASSWORD", "Demo#2026")


def call(method, path, body=None, token=None, files=None):
    url = f"{API}{path}"
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        payload = e.read().decode()
        print(f"  ! {method} {path} -> {e.code} {payload[:300]}")
        return {}


def phone():
    return "091" + str(random.randint(1000000, 9999999))


def signup(account_type, business_name, extra=None):
    ph = phone()
    body = {
        "fullName": f"مالك {business_name}",
        "phone": ph,
        "password": PASSWORD,
        "confirmPassword": PASSWORD,
        "accountType": account_type,
        "businessName": business_name,
        "city": "طرابلس",
    }
    if extra:
        body.update(extra)
    reg = call("POST", "/auth/register", body)
    code = reg.get("devCode")
    ver = call("POST", "/auth/verify-otp", {"phone": ph, "code": code, "purpose": "register"})
    token = ver.get("token")
    print(f"  {business_name}: phone={ph} token={'ok' if token else 'FAILED'}")
    return ph, token


def build_seller():
    ph, token = signup("online_seller", "متجر ليبيا أونلاين")
    if not token:
        return None
    acc = call("POST", "/merchant/payment-accounts", {
        "type": "bank", "provider": "مصرف الجمهورية", "accountHolder": "متجر ليبيا أونلاين",
        "accountNumber": "0210045512", "iban": "LY83002048000020100120361", "isDefault": True,
    }, token).get("account", {})
    call("POST", "/merchant/payment-accounts", {
        "type": "wallet", "provider": "سداد", "accountHolder": "متجر ليبيا أونلاين",
        "walletIdentifier": "0913334455",
    }, token)
    acc_ids = [acc.get("_id")] if acc.get("_id") else []

    call("POST", "/org/branches", {"name": "الفرع الرئيسي", "city": "طرابلس", "phone": "0213334455"}, token)
    products = []
    for name, price in [("قميص قطن", 120), ("حقيبة جلد", 380), ("ساعة يد", 750), ("خدمة تغليف هدايا", 25)]:
        p = call("POST", "/org/products", {"name": name, "kind": "service" if "خدمة" in name else "product", "price": price}, token)
        if p.get("product"):
            products.append(p["product"])
    couriers = []
    for name, ph2, area in [("سالم المندوب", "0914445566", "طرابلس"), ("عمر التوصيل", "0925556677", "زليتن")]:
        c = call("POST", "/org/couriers", {"name": name, "phone": ph2, "area": area}, token)
        if c.get("courier"):
            couriers.append(c["courier"])

    call("POST", "/org/employees", {
        "fullName": "هدى المحاسبة", "phone": phone(), "password": PASSWORD, "role": "accountant",
    }, token)
    call("POST", "/org/employees", {
        "fullName": "مراد الكاشير", "phone": phone(), "password": PASSWORD, "role": "cashier",
    }, token)

    customers = [("أحمد علي", "0921112233"), ("فاطمة سعيد", "0932223344"), ("محمد الهادي", "0943334455")]
    tokens = []
    for i, (name, cph) in enumerate(customers):
        r = call("POST", "/payment-requests", {
            "customer": {"name": name, "phone": cph, "city": "طرابلس"},
            "originalAmount": [1200, 450, 890][i],
            "discountType": "percentage" if i == 0 else "none",
            "discountValue": 10 if i == 0 else 0,
            "description": ["طلب ملابس صيفية", "حقيبة جلد بنية", "ساعة يد رجالية"][i],
            "paymentAccountIds": acc_ids,
            "expiresInDays": 7,
        }, token).get("request")
        if not r:
            continue
        tokens.append(r["publicToken"])
        if i == 0:
            call("POST", f"/payment-requests/{r['_id']}/payments", {"amount": 500, "method": "bank_transfer", "transactionNumber": "TX-500"}, token)
        if i == 1:
            call("POST", f"/payment-requests/{r['_id']}/payments", {"amount": 450, "method": "cash"}, token)

    if products and couriers:
        order = call("POST", "/orders", {
            "customer": {"name": "سعاد إبراهيم", "phone": "0955556677", "city": "مصراتة", "address": "شارع طرابلس، بجوار الصيدلية"},
            "items": [
                {"name": products[0]["name"], "productId": products[0]["_id"], "quantity": 2, "unitPrice": products[0]["price"]},
                {"name": products[1]["name"], "productId": products[1]["_id"], "quantity": 1, "unitPrice": products[1]["price"]},
            ],
            "deliveryFee": 30,
            "discountAmount": 20,
            "deliveryNotes": "الاتصال قبل الوصول بنصف ساعة",
            "courierId": couriers[0]["_id"],
            "createPaymentRequest": True,
        }, token).get("order")
        if order:
            call("POST", f"/orders/{order['_id']}/delivery-status", {"deliveryStatus": "preparing"}, token)
            call("POST", f"/orders/{order['_id']}/delivery-status", {"deliveryStatus": "with_courier"}, token)
            print(f"  courierToken={order.get('courierToken')}")

    call("POST", "/support/tickets", {
        "subject": "استفسار عن حدود الخطة المجانية",
        "category": "subscription",
        "description": "نحتاج رفع عدد طلبات الدفع الشهرية، ما هي الخطة المناسبة؟",
    }, token)

    print(f"  seller public tokens: {tokens}")
    return {"phone": ph, "token": token, "publicTokens": tokens}


def build_company():
    ph, token = signup("company", "شركة النور للتجارة", {"commercialRegister": "TR-99881", "taxNumber": "TX-55221"})
    if not token:
        return None
    acc = call("POST", "/merchant/payment-accounts", {
        "type": "bank", "provider": "مصرف الوحدة", "accountHolder": "شركة النور للتجارة",
        "accountNumber": "5544332211", "iban": "LY19002110000030200456789", "isDefault": True,
    }, token).get("account", {})
    acc_ids = [acc.get("_id")] if acc.get("_id") else []
    inv = call("POST", "/invoices", {
        "customer": {"name": "مؤسسة الفجر", "phone": "0916667788"},
        "items": [
            {"name": "توريد أجهزة حاسوب", "quantity": 3, "unitPrice": 4200},
            {"name": "تركيب وتدريب", "quantity": 1, "unitPrice": 900},
        ],
        "discountType": "fixed",
        "discountValue": 300,
        "notes": "الدفع على دفعتين",
        "createPaymentRequest": True,
        "paymentAccountIds": acc_ids,
    }, token)
    req = inv.get("request")
    if req:
        call("POST", f"/payment-requests/{req['_id']}/payments", {"amount": 6000, "method": "bank_transfer", "transactionNumber": "TX-6000"}, token)
    print(f"  company invoice: {inv.get('invoice', {}).get('invoiceNumber')}")
    return {"phone": ph, "token": token}


if __name__ == "__main__":
    print("Seeding demo data…")
    seller = build_seller()
    company = build_company()
    out = {"password": PASSWORD, "seller": seller, "company": company}
    path = os.environ.get("DEMO_OUT", "/tmp/amwali-demo.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"Saved -> {path}")
    sys.exit(0)
