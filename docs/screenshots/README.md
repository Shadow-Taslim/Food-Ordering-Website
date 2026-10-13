# Implementation & Testing Evidence

This folder holds the visual evidence for the project report.

| File | What it shows |
|------|---------------|
| `01-home.png` | Customer storefront home page |
| `02-register.png` | Registration popup (JWT + bcrypt auth) |
| `03-menu.png` | Menu browsing with categories |
| `04-cart.png` | Cart with $46 items + $2 delivery = $48 total |
| `05-checkout.png` | Checkout address form (step 1) |
| `06-payment-attempt.png` | Stripe stack exercised — gateway responds ("Invalid API Key" with demo keys) |
| `07-admin-add.png` | Admin panel: add food item with Multer image upload |
| `08-admin-list.png` | Admin panel: 32 seeded items listed |
| `09-admin-orders.png` | Admin panel: order with delivery address, $48 |
| `10-my-orders.png` | Customer "My Orders" page |
| `stripe-webhook-log.txt` | Server log: signed webhook replay marks order PAID (included here as text) |

The PNG screenshots are binary and are delivered alongside the project report
(zip / report document). To add them to the repository, upload them to this
folder via the GitHub web UI ("Add file → Upload files") — the README image
links already point at these paths.

`../architecture.png` (3-tier architecture diagram) is delivered the same way.
