Customers->
  1. Static site for customers to go through
  2. The data is feeded from Db.
  3. Feedback submissions by customers with contact details.
  4. Available pages - 
      1. Homepage
      2. Contact us
      3. Menu pages
      4. About us
      5. Feedback

Admin->
  1. Can handle the database
  2. Should login to get into the system
  3. Available pages - 
      1. Homepage
      2. Employee management page
      3. Store goods management page
      4. View customer Feedback
      5. Menu management page
      
Employees->
  1. Can check their details and can feedback related to their role.
  2. Should login to get into system
  3. Available pages - 
      1. Homepage
      2. Feedback page
      3. Respective details

Cashier->
  1. Login with cashiers credentials
  2. Available pages -
      1. History of bills
      2. Billing page

Database required ->
  1. user_details
  2. employee_details
  3. stock_details
  4. stock_history
  5. feedback_details
  6. session_check

Changes to be made ->
  1. Setup - Db
  2. Dal - database connection
  3. View - split according to actors
  4. Change UI for all actors
  5. Routes - change routes
  6. Controller - change controllers
  7. Change dal callbacks
  8. Configure constants