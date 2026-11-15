# Delivery details form (J&T) → Telegram

A one-page website that collects a customer's delivery details and sends each order to your Telegram chat. Tap any field in the Telegram message to copy it, then paste it into the J&T app.

## What's in the folder

```
index.html        the form customers see
api/submit.js     the Vercel function that checks the details and sends them to Telegram
package.json      project info (Vercel needs it to be present)
```

Keep the `api` folder exactly as named, or the function won't be found.

## Deploy on Vercel

1. **Put the files on GitHub.** Create a new repository (private is fine) and add the three files above, keeping the `api/submit.js` path.
   - On a phone, use *Add file → Create new file*, type `api/submit.js` as the file name (the slash makes the folder) and paste the code. Repeat for `index.html` and `package.json`.
2. **Import it into Vercel.** On vercel.com choose *Add New → Project*, pick the repository, leave Framework Preset as **Other**, and press Deploy.
3. **Add your two secrets.** In the project go to *Settings → Environment Variables* and add:

   | Name | Value |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | the token from @BotFather |
   | `TELEGRAM_CHAT_ID` | `1095947677` |

4. **Redeploy.** Changes to variables only apply to new deployments: *Deployments → ⋯ → Redeploy*.
5. **Test it.** Open your Vercel link, submit a test order, and check Telegram.

Never paste the bot token into `index.html` or `submit.js`. If it ever leaks, send `/revoke` to @BotFather to get a new one, and update the variable in Vercel.

## If something goes wrong

- **"The order form is not set up yet"**: one of the two variables is missing, or you haven't redeployed since adding them.
- **"Could not send your details"**: open the project's *Logs* in Vercel. Usually the token is wrong, or you haven't sent "hi" to your bot yet (a bot can't message you first).
- **Nothing arrives but the form says thank you**: the spam protection treated the submission as a bot (submitted in under 3 seconds, or the hidden field was filled in). Real customers never trigger this.

## Things you can change

- **Shop name:** at the top of the script in `index.html`, set `SHOP_NAME`.
- **Privacy notice wording:** the text under "Privacy notice" in `index.html`. Review it so it matches how you really use customers' details (Malaysia's PDPA applies).
- **State field:** it is suggested from the postcode, and the customer can change it. The city is typed by the customer.

## Good to know

- This version only covers delivery details. It does not take items or payment.
- Telegram is the only place orders are stored. If you delete the chat, the orders are gone. A Google Sheet backup is the planned next step.
- There is no rate limit beyond the spam traps. If someone floods the form, turn on rate limiting under Vercel's *Firewall* settings.
