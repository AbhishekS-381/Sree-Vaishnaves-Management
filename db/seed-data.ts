// Automatically generated from local JSON files

export const seedData: Record<string, string> = {};

seedData['advances.json'] = `[]`;
seedData['attendance.json'] = `[]`;
seedData['branches.json'] = `[{"id":"br_1","name":"Sree Vaishnaves","address":"Rajiv Gandhi Road","phone":"9080441018","status":"operational"},{"id":"br_2","name":"Vaishnaves Classic","address":"Talap","phone":"555-0101","status":"maintenance","internalStartTime":"05:00","internalEndTime":"23:00","customerStartTime":"06:00","customerEndTime":"22:00"}]`;
seedData['categories.json'] = `[{"id":"cat_1","name":"Maintenance","color":"#f87171"},{"id":"cat_2","name":"Raw materials","color":"#4ade80"},{"id":"cat_3","name":"Packaging","color":"#fbbf24"},{"id":"cat_4","name":"Gas / fuel","color":"#60a5fa"},{"id":"cat_5","name":"Rent","color":"#c084fc"},{"id":"cat_6","name":"Electricity","color":"#fcd34d"}]`;
seedData['config.json'] = `[{"id":"global","attendance":false,"payroll":false,"vendors":false,"inventory":false,"menu":false,"reports":false}]`;
seedData['daily_tally.json'] = `[]`;
seedData['departments.json'] = `[{"id":"dept_kitchen","name":"Kitchen"},{"id":"dept_service","name":"Service/Floor"},{"id":"dept_utility","name":"Utility/Others"},{"id":"dept_accounts","name":"Accounts/Counter"},{"id":"dept_2ee23c69","name":"Management"}]`;
seedData['eod.json'] = `[]`;
seedData['expenses.json'] = `[]`;
seedData['inventory.json'] = `[]`;
seedData['menu.json'] = `[]`;
seedData['menu_categories.json'] = `[]`;
seedData['payroll.json'] = `[]`;
seedData['roles.json'] = `[{"id":"role_owner","name":"Owner","departmentIds":["dept_2ee23c69"]},{"id":"role_manager","name":"Manager","departmentIds":["dept_2ee23c69"]},{"id":"role_chef","name":"Cook - Main","departmentIds":["dept_kitchen"],"isChef":false},{"id":"role_waiter","name":"Waiter","departmentIds":["dept_service"]},{"id":"role_helper","name":"Helper - Main","departmentIds":["dept_kitchen"],"isChef":false},{"id":"role_6807849f","name":"Supervisor - Kitchen","isChef":false,"departmentIds":["dept_kitchen"]},{"id":"role_a366e668","name":"Supervisor - Service/Cleaning","isChef":false,"departmentIds":["dept_service","dept_utility"]},{"id":"role_1249a548","name":"Service Captain","isChef":false,"departmentIds":["dept_service"]},{"id":"role_0a0ac7b4","name":"Cook - Coffee/Tea","isChef":false,"departmentIds":["dept_kitchen"]},{"id":"role_6335331f","name":"Cook - Poori/Chapathi/Parotta","isChef":false,"departmentIds":["dept_kitchen"]},{"id":"role_8d73a90e","name":"Cook - Dosa","isChef":false,"departmentIds":["dept_kitchen"]},{"id":"role_2dea53fc","name":"Helper - Cutting","isChef":false,"departmentIds":["dept_kitchen"]},{"id":"role_5b8f9f2b","name":"Helper - Grinder","isChef":false,"departmentIds":["dept_kitchen"]},{"id":"role_a18ff616","name":"Cook - Chineese/Tandori","isChef":false,"departmentIds":["dept_kitchen"]},{"id":"role_40d72d86","name":"Helper - Chineese/Tandori","isChef":false,"departmentIds":["dept_kitchen"]},{"id":"role_552f7edc","name":"Cleaning","isChef":false,"departmentIds":["dept_kitchen","dept_service"]},{"id":"role_24f3e680","name":"Cook - Snacks","isChef":false,"departmentIds":["dept_kitchen"]},{"id":"role_30e38b2d","name":"Security","isChef":false,"departmentIds":["dept_utility"]},{"id":"role_1d4a31ba","name":"Cashier","isChef":false,"departmentIds":["dept_accounts"]},{"id":"role_a9ec26cd","name":"Billing","isChef":false,"departmentIds":["dept_accounts"]},{"id":"role_ec6ce088","name":"Helper - Parcel/Setting","isChef":false,"departmentIds":["dept_kitchen"]}]`;
seedData['staff.json'] = `[]`;
seedData['staff_requirements.json'] = `[]`;
seedData['stock_adjustments.json'] = `[]`;
seedData['users.json'] = `[{"id":"u_owner_default","name":"Abhishek","password":"$2b$10$dhprGNq0tklhM.Q90uS0ke82tyLy0EnzW.9hbchzK6.Ii2yqbdMUy","role":"owner"}]`;
seedData['vendors.json'] = `[]`;
