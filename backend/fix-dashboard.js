// fix-dashboard.js - Run with: node fix-dashboard.js
const fs = require('fs');
const path = require('path');

const handlerPath = './src/handlers/buildmart.js';

console.log('📝 Fixing dashboard handler...');

let content = fs.readFileSync(handlerPath, 'utf8');

// Find the handleBuildMartDashboard function
const dashboardRegex = /export async function handleBuildMartDashboard\(request, env, ctx, corsHeaders\) \{[\s\S]*?\n\}/;
const match = content.match(dashboardRegex);

if (match) {
    console.log('✅ Found handleBuildMartDashboard function');
    
    // Improved version with better error handling
    const fixedFunction = `export async function handleBuildMartDashboard(request, env, ctx, corsHeaders) {
    try {
      const result = await env.DB.prepare(\`
        SELECT
          COALESCE((SELECT COUNT(*) FROM products WHERE category IN ('cement','roofing','paints','plumbing','electrical','timber','tools','hardware','tiles','gas-cylinders','steel','insulation','windows','sanitary','aggregates')), 0) as total_products,
          COALESCE((SELECT COUNT(*) FROM customers), 0) as total_customers,
          COALESCE((SELECT COUNT(*) FROM construction_projects WHERE status = 'active'), 0) as active_projects,
          COALESCE((SELECT COUNT(DISTINCT state) FROM delivery_regions WHERE state IS NOT NULL AND state != ''), 0) as states_covered,
          COALESCE((SELECT COUNT(*) FROM delivery_vehicles WHERE status = 'active'), 0) as active_trucks,
          COALESCE((SELECT SUM(budget) FROM construction_projects), 0) as total_value,
          COALESCE((SELECT COUNT(*) FROM staff WHERE role = 'procurement'), 0) as procurement_staff,
          COALESCE((SELECT COUNT(*) FROM warehouses WHERE status = 'active'), 0) as warehouse_count
      \`).first();

      return new Response(JSON.stringify({
        success: true,
        data: result || {
          total_products: 0,
          total_customers: 0,
          active_projects: 0,
          states_covered: 0,
          active_trucks: 0,
          total_value: 0,
          procurement_staff: 0,
          warehouse_count: 0
        }
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    } catch (e) {
      console.error('Dashboard error:', e.message);
      return new Response(JSON.stringify({ 
        success: false, 
        error: e.message,
        data: {
          total_products: 0,
          total_customers: 0,
          active_projects: 0,
          states_covered: 0,
          active_trucks: 0,
          total_value: 0,
          procurement_staff: 0,
          warehouse_count: 0
        }
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }`;
    
    // Replace the function
    content = content.replace(dashboardRegex, fixedFunction);
    fs.writeFileSync(handlerPath, content);
    console.log('✅ Fixed dashboard handler');
} else {
    console.log('❌ Could not find handleBuildMartDashboard function');
}
