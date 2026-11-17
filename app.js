
  
function getCurrentSchoolYearStart(){const now=new Date();return now.getMonth()>=5?now.getFullYear():now.getFullYear()-1;}
function getSchoolYearOptions(existing=[]){const start=getCurrentSchoolYearStart(),years=[];for(let y=start;y<=start+49;y++)years.push(`${y}-${y+1}`);for(const value of existing||[]){const v=String(value||'').trim();if(/^\d{4}-\d{4}$/.test(v)&&!years.includes(v))years.push(v);}return [...new Set(years)].sort((a,b)=>Number(a.slice(0,4))-Number(b.slice(0,4)));}
function populateSchoolYearDropdown(selected=''){const el=document.getElementById('schoolYear');if(!el)return;const years=getSchoolYearOptions();el.innerHTML='<option value="">Select school year</option>'+years.map(y=>`<option value="${y}">${y.replace('-', '–')}</option>`).join('');if(selected&&years.includes(selected))el.value=selected;else el.value=`${getCurrentSchoolYearStart()}-${getCurrentSchoolYearStart()+1}`;}



const titles={dashboard:"Dashboard",enrollment:"New Enrollment",records:"Enrollment Records",trash:"Trash",print:"Print",logs:"Activity Logs",settings:"System Settings",users:"User Management",census:"Enrollment Census",reports:"Reports & Statistics",learnerid:"Learner ID",logout:"Logout"};
const RECORDS_KEY="tnhsEnrollmentRecords",LOGS_KEY="tnhsActivityLogs",ACCOUNT_KEY="tnhsAdminAccount";
const DEFAULT_ACCOUNT={username:"tnhs.enrollment.admin@gmail.com",displayName:"TNHS Enrollment Admin"};
const SUPABASE_URL="https://yzmgiabfrapdjllhjfwe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_YDD0oNYQyCXur28qevC_qA_602uluWy";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{storageKey:"tnhs-ces-phase28-05-auth-token"}});
let currentAuthUser=null;
let currentProfile=null;
const ROLE_LABELS={administrator:"Administrator",registrar:"Registrar",enrollment_staff:"Enrollment Staff",read_only:"Read-only"};
function canWrite(){return !!currentProfile&&["administrator","registrar","enrollment_staff"].includes(currentProfile.role)}
function canManageTrash(){return !!currentProfile&&["administrator","registrar","enrollment_staff"].includes(currentProfile.role)}
function canViewLogs(){return !!currentProfile&&["administrator","registrar"].includes(currentProfile.role)}
function canManageUsers(){return !!currentProfile&&currentProfile.role==="administrator"}
async function loadCurrentProfile(){if(!currentAuthUser)throw new Error("No authenticated account.");const {data:sessionData,error:sessionError}=await supabaseClient.auth.getSession();if(sessionError)throw new Error(`Could not verify the signed-in session: ${sessionError.message||sessionError}`);const session=sessionData?.session;if(!session?.access_token||session.user?.id!==currentAuthUser.id)throw new Error("The sign-in was accepted, but the authenticated session was not ready for database access. Please sign in again once.");const {data,error}=await supabaseClient.from("user_profiles").select("user_id,display_name,role,is_active").eq("user_id",currentAuthUser.id).maybeSingle();if(error)throw error;if(!data)throw new Error("This school account is not registered in the TNHS enrollment system. Please contact the system administrator.");if(!data.is_active)throw new Error("Your school account is currently inactive. Please contact the system administrator for assistance.");currentProfile=data;}
const loginScreen=document.getElementById("loginScreen"),appShell=document.querySelector(".app");
const loginForm=document.getElementById("loginForm"),loginError=document.getElementById("loginError"),usernameInput=document.getElementById("username"),passwordInput=document.getElementById("password"),togglePassword=document.getElementById("togglePassword"),turnstileContainer=document.getElementById("turnstileWidget");
const enrollmentForm=document.getElementById("enrollmentForm");
let currentStep=1,lastSavedRecord=null,currentRecordId=null;
let recordsCurrentPage=1;

let selectedStudentPhoto=null, selectedStudentPhotoUrl="", currentPhotoPath="";
const photoUrlCache=new Map();
function clearSensitivePhotoState(){photoUrlCache.clear();selectedStudentPhoto=null;selectedStudentPhotoUrl="";currentPhotoPath="";document.querySelectorAll('img[src*="student-photos"]').forEach(img=>{img.removeAttribute("src");img.alt="Student photo";});}
async function getStudentPhotoUrl(path){if(!path)return "";const cached=photoUrlCache.get(path);if(cached&&cached.expires>Date.now()+30000)return cached.url;const {data,error}=await supabaseClient.storage.from("student-photos").createSignedUrl(path,300);if(error)throw error;photoUrlCache.set(path,{url:data.signedUrl,expires:Date.now()+270000});return data.signedUrl;}
function photoMarkup(url,cls="student-photo-thumb"){return url?`<img class="${cls}" src="${esc(url)}" alt="Student photo">`:`<div class="${cls} photo-empty">No photo</div>`;}
let recordsCache=[];
let logsCache=[];
function getRecords(){return recordsCache}
function getActiveRecords(){return recordsCache.filter(r=>!r.deletedAt)}
function getTrashRecords(){return recordsCache.filter(r=>!!r.deletedAt)}
function getAccount(){return {...DEFAULT_ACCOUNT}}
function setAccount(v){}
function currentUser(){return currentProfile?.display_name||currentAuthUser?.email||DEFAULT_ACCOUNT.username}
function getLogs(){return logsCache}
function normalizeBool(v){return v===true||v==="Yes"}
function rowToRecord(r){return {
  recordId:r.record_id,photoPath:r.student_photo_path||"",status:r.status||"Active",enrollmentClassification:r.enrollment_classification||"Standard",statusEffectiveDate:r.status_effective_date||null,statusReason:r.status_reason||"",statusUpdatedBy:r.status_updated_by||null,createdAt:r.created_at,updatedAt:r.updated_at,createdBy:r.created_by_display_name||"—",deletedAt:r.deleted_at||null,
  schoolYear:r.school_year,gradeLevel:r.grade_level,sectionName:r.section_name||"",psa:r.psa_birth_certificate_no||"",lrn:r.lrn,lastName:r.last_name||"",firstName:r.first_name||"",middleName:r.middle_name||"",extensionName:r.extension_name||"",birthdate:r.birthdate,placeOfBirth:r.place_of_birth||"",
  currentAddress:{house:r.current_house_no_street||"",street:r.current_street_name||"",barangay:r.current_barangay||"",municipality:r.current_municipality_city||"",province:r.current_province||"",zip:r.current_zip_code||"",country:r.current_country||""},
  permanentAddressSame:r.permanent_same_as_current?"Yes":"No",permanentAddress:{house:r.permanent_house_no_street||"",street:r.permanent_street_name||"",barangay:r.permanent_barangay||"",municipality:r.permanent_municipality_city||"",province:r.permanent_province||"",zip:r.permanent_zip_code||""},
  father:{last:r.father_last_name||"",first:r.father_first_name||"",middle:r.father_middle_name||"",contact:r.father_contact_number||"",notProvided:!!r.father_not_provided},
  mother:{last:r.mother_last_name||"",first:r.mother_first_name||"",middle:r.mother_middle_name||"",contact:r.mother_contact_number||"",notProvided:!!r.mother_not_provided},
  age:r.age==null?"":String(r.age),motherTongue:r.mother_tongue||"",returning:r.returning_balik_aral==null?"":(r.returning_balik_aral?"Yes":"No"),sex:r.sex||"",ipCommunity:r.ip_community==null?"":(r.ip_community?"Yes":"No"),ipSpecification:r.ip_specification||"",fourPs:r.four_ps_beneficiary==null?"":(r.four_ps_beneficiary?"Yes":"No"),fourPsHouseholdId:r.four_ps_household_id||"",
  guardian:{last:r.guardian_last_name||"",first:r.guardian_first_name||"",middle:r.guardian_middle_name||"",contact:r.guardian_contact_number||""},lastGradeCompleted:r.shs_last_grade_level_completed||"",lastSchoolYear:r.shs_last_school_year_completed||"",lastSchoolAttended:r.shs_last_school_attended||"",schoolId:r.shs_school_id||"",semester:r.shs_semester||"",track:r.shs_track||"",strand:r.shs_strand||"",parentGuardianPrintedName:r.parent_guardian_printed_name||"",certificationDate:r.certification_date||"",modalities:r.learning_modalities||[]
}}
function recordToRow(r,createdById=null){return {record_id:r.recordId,student_photo_path:r.photoPath||null,school_year:r.schoolYear,grade_level:r.gradeLevel,section_name:r.sectionName||null,lrn:r.lrn,psa_birth_certificate_no:r.psa||null,last_name:r.lastName||null,first_name:r.firstName||null,middle_name:r.middleName||null,extension_name:r.extensionName||null,birthdate:r.birthdate,place_of_birth:r.placeOfBirth||null,age:r.age?Number(r.age):null,mother_tongue:r.motherTongue||null,sex:r.sex||null,returning_balik_aral:r.returning?normalizeBool(r.returning):null,ip_community:r.ipCommunity?normalizeBool(r.ipCommunity):null,ip_specification:r.ipSpecification||null,four_ps_beneficiary:r.fourPs?normalizeBool(r.fourPs):null,four_ps_household_id:r.fourPsHouseholdId||null,current_house_no_street:r.currentAddress?.house||null,current_street_name:r.currentAddress?.street||null,current_barangay:r.currentAddress?.barangay||null,current_municipality_city:r.currentAddress?.municipality||null,current_province:r.currentAddress?.province||null,current_zip_code:r.currentAddress?.zip||null,current_country:r.currentAddress?.country||null,permanent_same_as_current:r.permanentAddressSame==="Yes",permanent_house_no_street:r.permanentAddress?.house||null,permanent_street_name:r.permanentAddress?.street||null,permanent_barangay:r.permanentAddress?.barangay||null,permanent_municipality_city:r.permanentAddress?.municipality||null,permanent_province:r.permanentAddress?.province||null,permanent_zip_code:r.permanentAddress?.zip||null,father_last_name:r.father?.last||null,father_first_name:r.father?.first||null,father_middle_name:r.father?.middle||null,father_contact_number:r.father?.contact||null,father_not_provided:!!r.father?.notProvided,mother_last_name:r.mother?.last||null,mother_first_name:r.mother?.first||null,mother_middle_name:r.mother?.middle||null,mother_contact_number:r.mother?.contact||null,mother_not_provided:!!r.mother?.notProvided,guardian_last_name:r.guardian?.last||null,guardian_first_name:r.guardian?.first||null,guardian_middle_name:r.guardian?.middle||null,guardian_contact_number:r.guardian?.contact||null,shs_last_grade_level_completed:r.lastGradeCompleted||null,shs_last_school_year_completed:r.lastSchoolYear||null,shs_last_school_attended:r.lastSchoolAttended||null,shs_school_id:r.schoolId||null,shs_semester:r.semester||null,shs_track:r.track||null,shs_strand:r.strand||null,learning_modalities:r.modalities||[],parent_guardian_printed_name:r.parentGuardianPrintedName||null,certification_date:r.certificationDate||null,status:r.status||"Active",created_by:createdById||null};}
async function loadRemoteData(){const jobs=[supabaseClient.from("enrollment_records").select("*").order("updated_at",{ascending:false})];if(canViewLogs()){jobs.push(supabaseClient.from("activity_logs").select("*").order("created_at",{ascending:false}));jobs.push(supabaseClient.from("enrollment_change_history").select("record_id,actor_display_name,change_type,changed_fields,changed_at").order("changed_at",{ascending:false}).limit(500));}const results=await Promise.all(jobs);const recordsResult=results[0],logsResult=results[1],historyResult=results[2];if(recordsResult.error)throw recordsResult.error;if(logsResult?.error)throw logsResult.error;if(historyResult?.error)throw historyResult.error;recordsCache=recordsResult.data.map(rowToRecord);const actionLogs=logsResult?.data?.map(x=>({timestamp:x.created_at,user:x.user_display_name||"—",action:x.action,recordId:x.record_id||"—",details:x.details||""}))||[];const changeLogs=historyResult?.data?.map(x=>({timestamp:x.changed_at,user:x.actor_display_name||"—",action:`Record ${x.change_type.replaceAll("_"," ")}`,recordId:x.record_id||"—",details:(x.changed_fields||[]).join(", ")}))||[];logsCache=[...actionLogs,...changeLogs].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));}
async function insertActivity(action,recordId,details=""){const {error}=await supabaseClient.from("activity_logs").insert({record_id:recordId||null,action,user_display_name:currentUser(),details:details||null});if(error)throw error;logsCache.unshift({timestamp:new Date().toISOString(),user:currentUser(),action,recordId:recordId||"—",details});}
async function insertEnrollment(record){const row=recordToRow(record,currentAuthUser?.id||null);const {data,error}=await supabaseClient.from("enrollment_records").insert(row).select("*").single();if(error)throw error;const saved=rowToRecord(data);recordsCache.unshift(saved);return saved;}
async function updateEnrollment(recordId,record,expectedUpdatedAt){const row=recordToRow(record,currentAuthUser?.id||null);delete row.record_id;delete row.created_by;let query=supabaseClient.from("enrollment_records").update({...row,updated_at:new Date().toISOString()}).eq("record_id",recordId);if(expectedUpdatedAt)query=query.eq("updated_at",expectedUpdatedAt);const {data,error}=await query.select("*").maybeSingle();if(error)throw error;if(!data){const conflict=new Error("This record was changed by another user after you opened it. Your changes were not saved. Reload the record and try again.");conflict.code="CONCURRENT_EDIT";throw conflict;}const saved=rowToRecord(data);const i=recordsCache.findIndex(x=>x.recordId===recordId);if(i>=0)recordsCache[i]=saved;return saved;}
async function updateDeletedAt(recordId,deletedAt,expectedUpdatedAt){let query=supabaseClient.from("enrollment_records").update({deleted_at:deletedAt,status:"Active"}).eq("record_id",recordId);if(expectedUpdatedAt)query=query.eq("updated_at",expectedUpdatedAt);const {data,error}=await query.select("*").maybeSingle();if(error)throw error;if(!data){const conflict=new Error("This record changed after you opened it. No changes were made. Refresh the records list and try again.");conflict.code="CONCURRENT_EDIT";throw conflict;}const saved=rowToRecord(data);const i=recordsCache.findIndex(x=>x.recordId===recordId);if(i>=0)recordsCache[i]=saved;return saved;}
function formatTime(v){const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString([],{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"})}
function formatDate(v){if(!v)return"—";const d=new Date(v+"T00:00:00");return Number.isNaN(d.getTime())?v:d.toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"})}
function formatBeefDate(v){if(!v)return"—";const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[2]}/${m[3]}/${m[1]}`:String(v)}
function actionClass(a){a=(a||"").toLowerCase();return a.includes("created")?"created":a.includes("updated")?"updated":a.includes("generated")||a.includes("printed")?"printed":""}

function updateDashboard(){const r=getActiveRecords(),l=getLogs(),g11=r.filter(x=>String(x.gradeLevel||"")==="11").length,g12=r.filter(x=>String(x.gradeLevel||"")==="12").length,total=g11+g12;document.getElementById("totalRecords").textContent=r.length;document.getElementById("grade11Count").textContent=g11;document.getElementById("grade12Count").textContent=g12;const todayKey=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());const todayCount=r.filter(x=>censusDateKey(x.createdAt)===todayKey).length;const todayCountEl=document.getElementById("todayEnrollmentCount");if(todayCountEl)todayCountEl.textContent=todayCount;const distributionTotal=document.getElementById("distributionTotal");if(distributionTotal)distributionTotal.textContent=total;const p11=total?Math.round(g11/total*100):0,p12=total?Math.round(g12/total*100):0;document.getElementById("grade11Percent").textContent=p11+"%";document.getElementById("grade12Percent").textContent=p12+"%";document.getElementById("grade11Bar").style.width=p11+"%";document.getElementById("grade12Bar").style.width=p12+"%";document.getElementById("distributionEmpty").style.display=total?"none":"flex";const cutoff=Date.now()-24*60*60*1000;const recent=l.filter(x=>{const t=new Date(x.timestamp||0).getTime();return Number.isFinite(t)&&t>=cutoff}).sort((a,b)=>new Date(b.timestamp||0)-new Date(a.timestamp||0)).slice(0,6);document.getElementById("recentActivityBody").innerHTML=recent.length?recent.map(x=>`<tr><td><span class="activity-badge ${actionClass(x.action)}">${esc(x.action||"Activity")}</span></td><td>${esc(x.recordId||"—")}</td><td>${formatTime(x.timestamp)}</td></tr>`).join(""):'<tr><td class="empty" colspan="3">No activity yet.</td></tr>'}
function resetModuleViews(){document.getElementById("recordsListView").style.display="block";document.getElementById("individualRecordView").style.display="none";document.getElementById("editRecordView").style.display="none"}
let navigationFeedbackTimer=null;
function startNavigationFeedback(){const bar=document.getElementById("navigationProgress");if(!bar)return;clearTimeout(navigationFeedbackTimer);bar.classList.remove("is-complete");bar.classList.add("is-active");bar.setAttribute("aria-hidden","false");navigationFeedbackTimer=setTimeout(()=>{bar.classList.add("is-complete");setTimeout(()=>{bar.classList.remove("is-active","is-complete");bar.setAttribute("aria-hidden","true")},180)},260)}
function showPage(id){startNavigationFeedback();if(id==="enrollment"&&!canWrite()){showToast("Your account has view-only access.");return}if(id==="trash"&&!canManageTrash()){showToast("Your account cannot manage Trash.");return}if(id==="logs"&&!canViewLogs()){showToast("Activity Logs are available to administrators and registrars.");return}if(id==="users"&&!canManageUsers()){showToast("User Management is available to administrators only.");return}document.querySelectorAll(".screen,.placeholder").forEach(x=>x.style.display=x.id===id?"block":"none");const recordsList=document.getElementById("recordsListView"),individual=document.getElementById("individualRecordView"),edit=document.getElementById("editRecordView");if(recordsList)recordsList.style.display=id==="records"?"block":"none";if(individual&&id!=="records")individual.style.display="none";if(edit&&id!=="records")edit.style.display="none";document.querySelectorAll("[data-page]").forEach(x=>x.classList.toggle("active",x.dataset.page===id));document.querySelectorAll(".sidebar .nav[data-page]").forEach(x=>{if(x.dataset.page===id)x.setAttribute("aria-current","page");else x.removeAttribute("aria-current")});const monitoringGroup=document.getElementById("enrollmentMonitoringGroup"),monitoringToggle=document.getElementById("enrollmentMonitoringToggle"),monitoringSubnav=document.getElementById("enrollmentMonitoringSubnav");if(monitoringGroup&&monitoringToggle&&monitoringSubnav){const monitoringActive=id==="census"||id==="reports";monitoringGroup.classList.toggle("has-active",monitoringActive);monitoringToggle.setAttribute("aria-expanded",String(monitoringActive||!monitoringSubnav.hidden));if(monitoringActive)monitoringSubnav.hidden=false;}document.getElementById("title").textContent=titles[id]||"Dashboard";if(id==="dashboard")updateDashboard();if(id==="census")renderCensus();if(id==="reports")renderReports();if(id==="learnerid")renderLearnerIdPage();if(id==="records"){resetModuleViews();renderRecords()}if(id==="trash"){renderTrash()}if(id==="print"){populatePrintRecords();renderSelectedPrint();renderEnrollmentBatchList()}if(id==="logs")renderLogs();if(id==="users")renderUsers();if(id==="settings")renderSettings();if(id==="enrollment"){if(document.getElementById("saveSuccessView")?.style.display!=="none")resetEnrollment();showEnrollmentMode("form")}}
function setLoggedIn(u){const name=currentProfile?.display_name||u;loginScreen.style.display="none";appShell.style.display="flex";document.querySelector(".avatar").textContent=name.charAt(0).toUpperCase();const userName=document.querySelector(".user-name");if(userName)userName.textContent=name;const roleLabel=document.getElementById("userRoleLabel");if(roleLabel)roleLabel.textContent=ROLE_LABELS[currentProfile?.role]||"Unassigned";syncBackupTabAccess();document.querySelectorAll('[data-page="enrollment"],#dashboardNewEnrollmentAction').forEach(el=>el.hidden=!canWrite());document.querySelectorAll('[data-page="trash"]').forEach(el=>el.hidden=!canManageTrash());document.querySelectorAll('[data-page="logs"]').forEach(el=>el.hidden=!canViewLogs());document.querySelectorAll('[data-page="users"]').forEach(el=>el.hidden=!canManageUsers());showPage("dashboard")}
function setLoggedOut(){clearSensitivePhotoState();recordsCache=[];logsCache=[];currentProfile=null;currentAuthUser=null;idAdviserAssignments={};loginScreen.style.display="grid";appShell.style.display="none";usernameInput.value="";passwordInput.value="";loginError.style.display="none"}
function describeLoginError(err,stage="sign-in"){
 const message=String(err?.message||err||"Unknown error");
 const code=String(err?.code||err?.status||"");
 const lower=message.toLowerCase();
 if(lower.includes("currently inactive"))return "Your school account is currently inactive. Please contact the system administrator for assistance.";
 if(lower.includes("not registered in the tnhs enrollment system"))return "This school account is not registered in the system. Please contact the system administrator.";
 if(stage==="sign-in"&&(lower.includes("invalid login credentials")||lower.includes("email not confirmed")||code==="400"))return "Sign-in failed. Please check your school email and password.";
 if(lower.includes("permission denied")||lower.includes("row-level security")||lower.includes("rls"))return "Your account could not access the required system information. Please contact the system administrator.";
 if(lower.includes("failed to fetch")||lower.includes("network")||lower.includes("timeout"))return "The system could not connect. Check your internet connection and try again.";
 return "We couldn't finish signing you in. Please try again or contact the system administrator.";
}

const TURNSTILE_SITE_KEY="0x4AAAAAAGCDcFYJ5Sx1XPUq";
let turnstileWidgetId=null,turnstileToken="";
function resetLoginTurnstile(){turnstileToken="";if(window.turnstile&&turnstileWidgetId!==null){try{window.turnstile.reset(turnstileWidgetId)}catch(error){console.warn("Turnstile reset failed",error)}}}
function renderLoginTurnstile(){if(!turnstileContainer||!window.turnstile||turnstileWidgetId!==null)return;turnstileWidgetId=window.turnstile.render(turnstileContainer,{sitekey:TURNSTILE_SITE_KEY,theme:"light",callback:token=>{turnstileToken=token;loginError.style.display="none"},"expired-callback":()=>{turnstileToken=""},"timeout-callback":()=>{turnstileToken=""},"error-callback":()=>{turnstileToken="";loginError.textContent="The security check could not load. Refresh the page and try again.";loginError.style.display="block"}})}
function waitForTurnstile(){if(window.turnstile){renderLoginTurnstile();return}setTimeout(waitForTurnstile,250)}
waitForTurnstile();
loginForm.addEventListener("submit",async e=>{e.preventDefault();const u=usernameInput.value.trim(),p=passwordInput.value,submit=loginForm.querySelector('button[type="submit"]');loginError.style.display="none";if(!turnstileToken){loginError.textContent="Please complete the security check before signing in.";loginError.style.display="block";turnstileContainer?.scrollIntoView({behavior:"smooth",block:"center"});return}if(submit?.disabled)return;if(submit){submit.disabled=true;submit.classList.add("is-processing");submit.setAttribute("aria-busy","true");submit.querySelector("span").textContent="Verifying…"}try{const {data:captchaData,error:captchaError}=await supabaseClient.functions.invoke("verify-turnstile",{body:{token:turnstileToken}});if(captchaError)throw new Error("The security check could not be verified. Please try again.");if(!captchaData?.valid)throw new Error("The security check was not accepted. Please verify again.");const {data,error}=await supabaseClient.auth.signInWithPassword({email:u,password:p});if(error)throw error;await activateSession(data.user)}catch(err){console.error("Sign-in request failed",err);loginError.textContent=err.message&&err.message.startsWith("The security check")?err.message:describeLoginError(err,"sign-in");loginError.style.display="block";passwordInput.focus();resetLoginTurnstile()}finally{if(submit){submit.disabled=false;submit.classList.remove("is-processing");submit.removeAttribute("aria-busy");submit.querySelector("span").textContent="Sign in"}}});
togglePassword.addEventListener("click",()=>{const v=passwordInput.type==="text";passwordInput.type=v?"password":"text";togglePassword.textContent=v?"Show":"Hide"});
function setMobileNav(open){const shell=document.querySelector(".app"),toggle=document.getElementById("menuToggle"),scrim=document.getElementById("sidebarScrim");if(!shell||!toggle||!scrim)return;shell.classList.toggle("nav-open",open);toggle.setAttribute("aria-expanded",String(open));toggle.setAttribute("aria-label",open?"Close navigation menu":"Open navigation menu");scrim.hidden=!open;document.body.classList.toggle("nav-lock",open)}
document.getElementById("menuToggle")?.addEventListener("click",()=>setMobileNav(!document.querySelector(".app")?.classList.contains("nav-open")));
document.getElementById("sidebarScrim")?.addEventListener("click",()=>setMobileNav(false));
document.addEventListener("keydown",e=>{if(e.key==="Escape")setMobileNav(false)});
document.querySelectorAll("[data-page]").forEach(el=>el.addEventListener("click",async()=>{const p=el.dataset.page;if(window.matchMedia("(max-width: 700px)").matches)setMobileNav(false);if(p==="logout"){await supabaseClient.auth.signOut();setLoggedOut();return}showPage(p)}));
document.getElementById("enrollmentMonitoringToggle")?.addEventListener("click",()=>{const panel=document.getElementById("enrollmentMonitoringSubnav"),toggle=document.getElementById("enrollmentMonitoringToggle");if(!panel||!toggle)return;panel.hidden=!panel.hidden;toggle.setAttribute("aria-expanded",String(!panel.hidden));});
document.getElementById("dashboardSearchBtn").addEventListener("click",()=>{const q=document.getElementById("dashboardSearch").value.trim();if(q){document.getElementById("recordsSearch").value=q;showPage("records")}else showPage("records")});
document.getElementById("dashboardSearch").addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("dashboardSearchBtn").click()});
document.getElementById("dashboardSearchAction").addEventListener("click",()=>showPage("records"));document.getElementById("dashboardNewEnrollmentAction").addEventListener("click",()=>{resetEnrollment();showPage("enrollment")});document.getElementById("dashboardViewRecordsAction").addEventListener("click",()=>showPage("records"));document.getElementById("dashboardPrintAction").addEventListener("click",()=>showPage("print"));

function setFieldInvalid(id,on){const el=document.getElementById(id);if(!el)return;el.closest(".form-field")?.classList.toggle("invalid",on)}
const lrnInput=document.getElementById("lrn");if(lrnInput){
  lrnInput.addEventListener("input",()=>{const digits=lrnInput.value.replace(/\D/g,"").slice(0,12);if(lrnInput.value!==digits)lrnInput.value=digits;setFieldInvalid("lrn",!!digits&&!/^\d{12}$/.test(digits))});
  lrnInput.addEventListener("beforeinput",e=>{if(e.inputType==="insertText"&&e.data&&!/^\d+$/.test(e.data))e.preventDefault()});
}
const titleCaseFieldIds=["lastName","firstName","middleName","extensionName","placeOfBirth","motherTongue","ipSpecification","curHouse","curStreet","curBarangay","curMunicipality","curProvince","curCountry","permHouse","permStreet","permBarangay","permMunicipality","permProvince","fatherLast","fatherFirst","fatherMiddle","motherLast","motherFirst","motherMiddle","guardianLast","guardianFirst","guardianMiddle","lastSchoolAttended","parentGuardianPrintedName"];
function capitalizeWords(value){return String(value??"").replace(/\s+/g," ").trim().toLocaleLowerCase().replace(/(^|[\s'’\-])([\p{L}])/gu,(m,prefix,letter)=>prefix+letter.toLocaleUpperCase())}
function bindCapitalization(root=document){titleCaseFieldIds.forEach(id=>{const el=root.getElementById?root.getElementById(id):root.querySelector(`#${CSS.escape(id)}`);if(!el||el.dataset.capitalizeBound==="1")return;el.dataset.capitalizeBound="1";el.addEventListener("blur",()=>{el.value=capitalizeWords(el.value)});el.addEventListener("change",()=>{el.value=capitalizeWords(el.value)})})}
bindCapitalization(document);
function isValidIsoDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||"")))return false;const [y,m,d]=value.split("-").map(Number);const date=new Date(y,m-1,d);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d}
function validateStep(step){
 let ok=true;
 const req=step===1?["schoolYear","gradeLevel","lrn","birthdate","lastName","firstName"]:[];
 req.forEach(id=>{const e=document.getElementById(id),bad=!e||!String(e.value).trim();setFieldInvalid(id,bad);if(bad)ok=false});
 if(step===1){
  const lrn=document.getElementById("lrn"),lrnValue=String(lrn?.value||"").trim();
  if(lrnValue&&!/^\d{12}$/.test(lrnValue)){setFieldInvalid("lrn",true);ok=false}
  const birthdate=document.getElementById("birthdate"),birthdateValue=String(birthdate?.value||"").trim();
  if(birthdateValue){const parsed=new Date(`${birthdateValue}T00:00:00`),today=new Date();today.setHours(0,0,0,0);const invalid=!isValidIsoDate(birthdateValue)||parsed>today;setFieldInvalid("birthdate",invalid);if(invalid)ok=false}
 }
 if(step===5){const cert=document.getElementById("certificationDate"),value=String(cert?.value||"").trim();if(value){const invalid=!isValidIsoDate(value);setFieldInvalid("certificationDate",invalid);if(invalid)ok=false}}
 if(step===3){["fatherContact","motherContact","guardianContact"].forEach(id=>{const e=document.getElementById(id);if(!e||e.disabled)return;const v=String(e.value||"").trim();const bad=!!v&&!/^09\d{9}$/.test(v);setFieldInvalid(id,bad);if(bad)ok=false})}
 return ok
}
function showStep(step){currentStep=Math.max(1,Math.min(5,step));document.querySelectorAll(".enroll-step").forEach(x=>x.style.display=Number(x.dataset.formStep)===currentStep?"block":"none");document.querySelectorAll(".step").forEach(x=>{const n=Number(x.dataset.step);x.classList.toggle("active",n===currentStep);x.classList.toggle("done",n<currentStep)});document.getElementById("prevStep").disabled=currentStep===1;document.getElementById("nextStep").textContent=currentStep===5?"Continue to Review":"Next"}
document.querySelectorAll(".step").forEach(b=>b.addEventListener("click",()=>{const t=Number(b.dataset.step);if(t<=currentStep||validateStep(currentStep))showStep(t)}));
document.getElementById("prevStep").addEventListener("click",()=>currentStep>1?showStep(currentStep-1):showPage("dashboard"));
document.getElementById("nextStep").addEventListener("click",()=>{if(!validateStep(currentStep))return;if(currentStep===1){const lrn=val("lrn"),existing=getActiveRecords().find(r=>r.lrn===lrn&&lrn);if(existing){const go=confirm(`Possible Duplicate Record\n\nA learner with this LRN already exists (${existing.recordId}).\n\nChoose OK to view the existing record, or Cancel to continue this enrollment.`);if(go){showPage("records");openRecord(existing.recordId);return}}}if(currentStep<5)showStep(currentStep+1);else buildReview()});
function conditional(name,wrap){document.querySelectorAll(`input[name="${name}"]`).forEach(r=>r.addEventListener("change",()=>{document.getElementById(wrap).style.display=r.checked&&r.value==="Yes"?"block":"none"}))}
conditional("ipCommunity","ipSpecifyWrap");conditional("fourPs","fourPsWrap");
function setupParentAvailability(){[["fatherNotProvided","fatherFields",["fatherLast","fatherFirst","fatherMiddle","fatherContact"]],["motherNotProvided","motherFields",["motherLast","motherFirst","motherMiddle","motherContact"]]].forEach(([check,wrap,fields])=>{const c=document.getElementById(check);if(!c)return;c.addEventListener("change",()=>{const off=c.checked;document.getElementById(wrap).style.opacity=off?".55":"1";fields.forEach(id=>{const el=document.getElementById(id);el.disabled=off;if(off)el.value=""})})})}
setupParentAvailability();
document.querySelectorAll('input[name="sameAddress"]').forEach(r=>r.addEventListener("change",()=>{const yes=document.querySelector('input[name="sameAddress"]:checked')?.value==="Yes";document.getElementById("permanentFields").style.display=yes?"none":"block";if(yes)copyAddress()}));
function copyAddress(){const map={curHouse:"permHouse",curStreet:"permStreet",curBarangay:"permBarangay",curMunicipality:"permMunicipality",curProvince:"permProvince",curZip:"permZip"};Object.entries(map).forEach(([a,b])=>document.getElementById(b).value=document.getElementById(a).value)}
["curHouse","curStreet","curBarangay","curMunicipality","curProvince","curZip"].forEach(id=>document.getElementById(id).addEventListener("input",()=>{if(document.querySelector('input[name="sameAddress"]:checked')?.value==="Yes")copyAddress()}));

function val(id){return document.getElementById(id)?.value?.trim()||""}
function radio(name){return document.querySelector(`input[name="${name}"]:checked`)?.value||""}
function checks(name){return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value)}
function collectFormData(){
  return {photoPath:currentPhotoPath||"",schoolYear:val("schoolYear"),gradeLevel:val("gradeLevel"),sectionName:val("sectionName"),psa:val("psa"),lrn:val("lrn"),lastName:val("lastName"),firstName:val("firstName"),middleName:val("middleName"),extensionName:val("extensionName"),birthdate:val("birthdate"),placeOfBirth:val("placeOfBirth"),
    currentAddress:{house:val("curHouse"),street:val("curStreet"),barangay:val("curBarangay"),municipality:val("curMunicipality"),province:val("curProvince"),zip:val("curZip"),country:val("curCountry")},
    permanentAddressSame:radio("sameAddress"),permanentAddress:{house:val("permHouse"),street:val("permStreet"),barangay:val("permBarangay"),municipality:val("permMunicipality"),province:val("permProvince"),zip:val("permZip")},
    father:{last:val("fatherLast"),first:val("fatherFirst"),middle:val("fatherMiddle"),contact:val("fatherContact"),notProvided:document.getElementById("fatherNotProvided")?.checked||false},mother:{last:val("motherLast"),first:val("motherFirst"),middle:val("motherMiddle"),contact:val("motherContact"),notProvided:document.getElementById("motherNotProvided")?.checked||false},
    age:val("age"),motherTongue:val("motherTongue"),returning:radio("returning"),sex:radio("sex"),ipCommunity:radio("ipCommunity"),ipSpecification:val("ipSpecification"),fourPs:radio("fourPs"),fourPsHouseholdId:val("fourPsHouseholdId"),
    guardian:{last:val("guardianLast"),first:val("guardianFirst"),middle:val("guardianMiddle"),contact:val("guardianContact")},lastGradeCompleted:val("lastGradeCompleted"),lastSchoolYear:val("lastSchoolYear"),lastSchoolAttended:val("lastSchoolAttended"),schoolId:val("schoolId"),semester:radio("semester"),track:val("track"),strand:val("strand"),
    parentGuardianPrintedName:val("parentGuardianPrintedName"),certificationDate:val("certificationDate"),modalities:checks("modalities")}}
async function uploadStudentPhoto(recordId){
 if(!selectedStudentPhoto)return currentPhotoPath||"";
 const ext=(selectedStudentPhoto.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
 const path=`${currentAuthUser.id}/${recordId}.${ext}`;
 const {error}=await supabaseClient.storage.from("student-photos").upload(path,selectedStudentPhoto,{upsert:true,contentType:selectedStudentPhoto.type,cacheControl:"3600"});
 if(error)throw new Error(`Student photo upload failed: ${error.message}`);
 currentPhotoPath=path;photoUrlCache.delete(path);selectedStudentPhoto=null;return path;
}
function showStudentPhoto(file){
 if(!file)return;
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)){alert("Please choose a JPG, PNG, or WEBP image.");return}
 if(file.size>5*1024*1024){alert("Photo must be 5 MB or smaller.");return}
 selectedStudentPhoto=file;selectedStudentPhotoUrl=URL.createObjectURL(file);
 document.getElementById("studentPhotoPreview").innerHTML=`<img alt="Selected student photo preview" src="${selectedStudentPhotoUrl}">`;
 document.getElementById("removeStudentPhoto").hidden=false;
}
document.getElementById("chooseStudentPhoto").addEventListener("click",()=>document.getElementById("studentPhotoUpload").click());
document.getElementById("captureStudentPhoto").addEventListener("click",openStudentCamera);
async function openStudentCamera(){
 if(!navigator.mediaDevices?.getUserMedia){alert("Camera capture is unavailable in this browser or page context. Use HTTPS or localhost, or upload a photo instead.");return;}
 let stream=null,activeFacing="user",closed=false,videoReady=false,devices=[],activeDeviceId=null;
 const overlay=document.createElement("div");overlay.className="camera-overlay";
 overlay.innerHTML=`<div class="camera-dialog" role="dialog" aria-modal="true" aria-label="Capture student photo"><h3>Take Student Photo</h3><div class="camera-stage"><video id="studentCameraVideo" autoplay playsinline muted></video><div class="camera-guide" aria-hidden="true"><div class="camera-guide-head"></div><div class="camera-guide-shoulders"></div><span>2 × 2 PHOTO GUIDE</span></div><div class="camera-loading" id="studentCameraLoading">Starting camera…</div></div><p class="camera-position-help">Center your face inside the oval. Keep your head upright and include your shoulders within the frame. Use a plain, well-lit background.</p><canvas id="studentCameraCanvas" hidden></canvas><div class="camera-actions"><button type="button" class="btn" id="cancelStudentCamera">Cancel</button><button type="button" class="btn" id="switchStudentCamera" hidden>Switch Camera</button><button type="button" class="btn primary" id="takeStudentSnapshot" disabled>Capture Photo</button></div><p class="camera-help">The guide is only for positioning and will not appear in your saved photo. The saved photo will match the mirrored camera preview.</p></div>`;
 document.body.appendChild(overlay);
 const video=overlay.querySelector("#studentCameraVideo"),captureBtn=overlay.querySelector("#takeStudentSnapshot"),switchBtn=overlay.querySelector("#switchStudentCamera"),loading=overlay.querySelector("#studentCameraLoading");
 const stopStream=()=>{if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}video.srcObject=null;videoReady=false;captureBtn.disabled=true;};
 const close=()=>{if(closed)return;closed=true;stopStream();overlay.remove();};
 overlay.querySelector("#cancelStudentCamera").onclick=close;
 const inferFacing=(device, fallback="environment")=>{
  const label=(device?.label||"").toLowerCase();
  if(/front|user|selfie|facetime|integrated camera.*front/.test(label))return "user";
  if(/back|rear|environment|world/.test(label))return "environment";
  return fallback;
 };
 async function refreshDevices(){
  try{devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==="videoinput");}catch(_){devices=[];}
  switchBtn.hidden=devices.length<2;
 }
 async function startCamera(deviceId=null,requestedFacing="user"){
  stopStream();activeDeviceId=deviceId;activeFacing=requestedFacing;loading.hidden=false;loading.textContent="Starting camera…";video.classList.toggle("camera-mirrored",activeFacing==="user");
  const videoConstraints=deviceId?{deviceId:{exact:deviceId},width:{ideal:1280},height:{ideal:1280}}:{facingMode:{ideal:requestedFacing},width:{ideal:1280},height:{ideal:1280}};
  try{
   stream=await navigator.mediaDevices.getUserMedia({video:videoConstraints,audio:false});
   if(closed){stopStream();return;}
   video.srcObject=stream;await video.play();
   if(!video.videoWidth||!video.videoHeight)await new Promise((resolve,reject)=>{video.addEventListener("loadedmetadata",resolve,{once:true});setTimeout(()=>reject(new Error("Camera preview did not become ready.")),5000);});
   const track=stream.getVideoTracks()[0],settings=track?.getSettings?.()||{};
   activeDeviceId=settings.deviceId||deviceId||null;
   await refreshDevices();
   const activeDevice=devices.find(d=>d.deviceId===activeDeviceId);
   activeFacing=settings.facingMode==="user"||settings.facingMode==="environment"?settings.facingMode:inferFacing(activeDevice,requestedFacing);
   video.classList.toggle("camera-mirrored",activeFacing==="user");
   videoReady=Boolean(video.videoWidth&&video.videoHeight);captureBtn.disabled=!videoReady;loading.hidden=videoReady;
   if(devices.length>1){const currentIndex=devices.findIndex(d=>d.deviceId===activeDeviceId);switchBtn.textContent=currentIndex>=0?`Switch Camera (${currentIndex+1}/${devices.length})`:"Switch Camera";}
  }catch(err){
   console.error("Camera access failed",err);stopStream();loading.hidden=false;
   loading.textContent=err.name==="NotAllowedError"?"Camera permission was denied. Allow camera access in your browser settings and try again.":err.name==="NotFoundError"?"No camera was found. Connect a camera or upload a photo instead.":`Unable to open the camera. ${err.message||err}`;
   captureBtn.disabled=true;
  }
 }
 switchBtn.onclick=async()=>{
  if(devices.length<2)return;
  const idx=devices.findIndex(d=>d.deviceId===activeDeviceId),next=devices[(idx+1+devices.length)%devices.length];
  const nextFacing=inferFacing(next,activeFacing==="user"?"environment":"user");
  await startCamera(next.deviceId,nextFacing);
 };
 captureBtn.onclick=()=>{
  if(!videoReady||!video.videoWidth||!video.videoHeight){alert("Camera is not ready yet. Please wait for the preview.");return;}
  const canvas=overlay.querySelector("canvas"),w=video.videoWidth,h=video.videoHeight,side=Math.min(w,h),sx=Math.round((w-side)/2),sy=Math.round((h-side)/2);
  canvas.width=1200;canvas.height=1200;
  const ctx=canvas.getContext("2d");
  // Match the live preview: front-facing captures are mirrored; rear/external captures follow their preview orientation.
  if(activeFacing==="user"){ctx.translate(canvas.width,0);ctx.scale(-1,1);}
  ctx.drawImage(video,sx,sy,side,side,0,0,1200,1200);
  canvas.toBlob(blob=>{if(!blob){alert("Unable to capture the photo.");return;}const file=new File([blob],`student-photo-${Date.now()}.jpg`,{type:"image/jpeg"});showStudentPhoto(file);document.getElementById("studentPhotoUpload").value="";close();},"image/jpeg",0.92);
 };
 await startCamera(null,"user");
}

document.getElementById("studentPhotoUpload").addEventListener("change",e=>showStudentPhoto(e.target.files?.[0]));
document.getElementById("studentPhotoCamera").addEventListener("change",e=>showStudentPhoto(e.target.files?.[0]));
document.getElementById("removeStudentPhoto").addEventListener("click",()=>{selectedStudentPhoto=null;currentPhotoPath="";document.getElementById("studentPhotoUpload").value="";document.getElementById("studentPhotoCamera").value="";document.getElementById("studentPhotoPreview").textContent="No photo selected";document.getElementById("removeStudentPhoto").hidden=true});
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function item(label,value){return `<div class="review-item"><span class="review-label">${esc(label)}</span><div class="review-value">${esc(value||"—")}</div></div>`}
function section(title,items,step){return `<div class="review-section"><div class="review-section-head"><strong>${esc(title)}</strong><button type="button" class="edit-section" data-edit-step="${step}">Edit</button></div><div class="review-grid">${items.join("")}</div></div>`}
function analyzeEnrollmentQuality(d){
  const warnings=[];
  const hasName=Boolean(String(d.lastName||"").trim()&&String(d.firstName||"").trim());
  if(!hasName)warnings.push("Learner's last name and first name should be checked.");
  const addressParts=[d.currentAddress?.house,d.currentAddress?.street,d.currentAddress?.barangay,d.currentAddress?.municipality,d.currentAddress?.province].filter(x=>String(x||"").trim()).length;
  if(addressParts<3)warnings.push("Current address has few completed parts. Check it against the submitted form.");
  if(d.permanentAddressSame!=="Yes"){
    const permanentParts=[d.permanentAddress?.house,d.permanentAddress?.street,d.permanentAddress?.barangay,d.permanentAddress?.municipality,d.permanentAddress?.province].filter(x=>String(x||"").trim()).length;
    if(permanentParts<3)warnings.push("Permanent address has few completed parts. Confirm whether the remaining fields should be filled.");
  }
  if(d.ipCommunity==="Yes"&&!String(d.ipSpecification||"").trim())warnings.push("IP Community is marked Yes, but the specification is blank.");
  if(d.fourPs==="Yes"&&!String(d.fourPsHouseholdId||"").trim())warnings.push("4Ps Beneficiary is marked Yes, but the household ID is blank.");
  if(!Array.isArray(d.modalities)||d.modalities.length===0)warnings.push("No learning modality is selected. Confirm the applicable option(s).");
  if(d.gradeLevel&&String(d.gradeLevel).toLowerCase().includes("12")&&!String(d.guardian?.first||"").trim()&&!String(d.guardian?.last||"").trim())warnings.push("Guardian name is blank. Check whether it is required for this learner.");
  if(d.birthdate){const date=new Date(d.birthdate+"T00:00:00");if(Number.isNaN(date.getTime())||date>new Date())warnings.push("Birthdate appears invalid or is in the future.");}
  return warnings;
}
function renderQualityCheck(d){
  const warnings=analyzeEnrollmentQuality(d);
  if(!warnings.length)return `<div class="quality-check quality-ok"><strong>Quality check</strong><p>No common completeness issues were detected. Review the submitted form before saving.</p></div>`;
  return `<div class="quality-check quality-warn"><strong>Review these items before saving</strong><p>This assistant flags possible issues only. It does not determine official enrollment eligibility, and it will not block saving.</p><ul>${warnings.map(w=>`<li>${esc(w)}</li>`).join("")}</ul></div>`;
}
async function buildReview(){if(!validateStep(5))return;const d=collectFormData(),current=`${d.currentAddress.house}, ${d.currentAddress.street}, ${d.currentAddress.barangay}, ${d.currentAddress.municipality}, ${d.currentAddress.province}, ${d.currentAddress.zip}, ${d.currentAddress.country}`.replace(/^, |, $/g,""),permanent=d.permanentAddressSame==="Yes"?"Same as current address":`${d.permanentAddress.house}, ${d.permanentAddress.street}, ${d.permanentAddress.barangay}, ${d.permanentAddress.municipality}, ${d.permanentAddress.province}, ${d.permanentAddress.zip}`.replace(/^, |, $/g,"");document.getElementById("reviewBody").innerHTML=section("Enrollment & Learner Information",[item("School Year",d.schoolYear),item("Grade Level to Enroll",d.gradeLevel),item("PSA Birth Certificate No.",d.psa),item("LRN",d.lrn),item("Last Name",d.lastName),item("First Name",d.firstName),item("Middle Name",d.middleName),item("Extension Name",d.extensionName),item("Birthdate",formatBeefDate(d.birthdate)),item("Place of Birth (Municipality/City)",d.placeOfBirth),item("Age",d.age),item("Mother Tongue",d.motherTongue),item("Returning (Balik-Aral)",d.returning),item("Sex",d.sex),item("IP Community",d.ipCommunity),item("IP Specification",d.ipSpecification),item("4Ps Beneficiary",d.fourPs),item("4Ps Household ID",d.fourPsHouseholdId)],1)+section("Address Information",[item("Current Address",current),item("Permanent Address",permanent),item("Same as Current Address?",d.permanentAddressSame)],2)+section("Parent & Guardian Information",[item("Father's Name",[d.father.last,d.father.first,d.father.middle].filter(Boolean).join(" ")),item("Father's Contact Number",d.father.contact),item("Mother's Maiden Name",[d.mother.last,d.mother.first,d.mother.middle].filter(Boolean).join(" ")),item("Mother's Contact Number",d.mother.contact),item("Guardian's Name",[d.guardian.last,d.guardian.first,d.guardian.middle].filter(Boolean).join(" ")),item("Guardian Contact Number",d.guardian.contact)],3)+section("Previous School & Senior High School Information",[item("Last Grade Level Completed",d.lastGradeCompleted),item("Last School Year Completed",d.lastSchoolYear),item("Last School Attended",d.lastSchoolAttended),item("School ID",d.schoolId),item("Semester",d.semester),item("Track",d.track),item("Strand",d.strand),item("Section",d.sectionName)],4)+section("Certification & Modality",[item("Signature Over Printed Name of Parent/Guardian",d.parentGuardianPrintedName),item("Date",formatBeefDate(d.certificationDate)),item("Preferred Distance Learning Modality/ies",d.modalities.length?d.modalities.join(", "):"—")],5)+renderQualityCheck(d)+`<div class="confirm-box">Please review the information carefully before saving.</div>`;const photoPath=d.photoPath||currentPhotoPath;const photoUrl=selectedStudentPhotoUrl||(photoPath?await getStudentPhotoUrl(photoPath).catch(err=>{console.warn("Review photo unavailable",err);return ""}):"");const photoCard=document.createElement("div");photoCard.className="review-photo-card";photoCard.innerHTML=`<strong>Student Photo</strong>${photoMarkup(photoUrl,"review-student-photo")}`;document.getElementById("reviewBody").prepend(photoCard);document.querySelectorAll(".edit-section").forEach(b=>b.addEventListener("click",()=>{showEnrollmentMode("form");showStep(Number(b.dataset.editStep))}));showEnrollmentMode("review")}
function showEnrollmentMode(mode){const formShell=document.querySelector("#enrollment > .enroll-shell"),review=document.getElementById("reviewView"),success=document.getElementById("saveSuccessView");if(formShell)formShell.style.display=mode==="form"?"block":"none";review.style.display=mode==="review"?"block":"none";success.style.display=mode==="success"?"block":"none"}
function generateRecordId(){const year=new Date().getFullYear().toString();let n=recordsCache.filter(x=>String(x.recordId||"").startsWith(`TNHS-${year}-`)).length+1;while(recordsCache.some(x=>x.recordId===`TNHS-${year}-${String(n).padStart(5,"0")}`))n++;return`TNHS-${year}-${String(n).padStart(5,"0")}`}
document.getElementById("confirmSave").addEventListener("click",async()=>{const data=collectFormData(),now=new Date().toISOString(),recordId=generateRecordId(),record={recordId,status:"Active",createdAt:now,updatedAt:now,createdBy:currentUser(),...data};const btn=document.getElementById("confirmSave");btn.disabled=true;try{record.photoPath=await uploadStudentPhoto(recordId);const saved=await insertEnrollment(record);await insertActivity("Created enrollment record",saved.recordId);lastSavedRecord=saved;document.getElementById("savedRecordId").textContent=saved.recordId;showEnrollmentMode("success");refreshAllDataViews()}catch(err){console.error(err);alert(`Unable to save the enrollment record. ${err.message||err}`)}finally{btn.disabled=false}});
document.getElementById("backToForm").addEventListener("click",()=>showEnrollmentMode("form"));
document.getElementById("newEnrollmentAfterSave").addEventListener("click",()=>{resetEnrollment();showEnrollmentMode("form");showStep(1)});
document.getElementById("viewSavedRecord").addEventListener("click",()=>openRecord(lastSavedRecord?.recordId));
document.getElementById("printSavedRecord").addEventListener("click",()=>{if(lastSavedRecord)window.dispatchEvent(new CustomEvent("tnhs:print-record",{detail:lastSavedRecord}))});
document.getElementById("qrSavedRecord").addEventListener("click",()=>{if(lastSavedRecord)showQrReceipt(lastSavedRecord)});
function resetEnrollment(){selectedStudentPhoto=null;currentPhotoPath="";document.getElementById("studentPhotoUpload").value="";document.getElementById("studentPhotoCamera").value="";document.getElementById("studentPhotoPreview").textContent="No photo selected";document.getElementById("removeStudentPhoto").hidden=true;enrollmentForm.reset();populateSchoolYearDropdown();populateStrandOptions("");document.getElementById("curCountry").value="Philippines";document.getElementById("fatherFields").style.display="grid";document.getElementById("motherFields").style.display="grid";document.querySelector('input[name="sameAddress"][value="No"]').checked=true;document.getElementById("permanentFields").style.display="block";document.getElementById("ipSpecifyWrap").style.display="none";document.getElementById("fourPsWrap").style.display="none";document.getElementById("fatherNotProvided").checked=false;document.getElementById("motherNotProvided").checked=false;document.getElementById("fatherNotProvided").dispatchEvent(new Event("change"));document.getElementById("motherNotProvided").dispatchEvent(new Event("change"));document.querySelectorAll(".form-field.invalid").forEach(x=>x.classList.remove("invalid"));showStep(1)}
window.addEventListener("tnhs:reset-enrollment",resetEnrollment);

function refreshAllDataViews(){updateDashboard();renderRecords();renderTrash();populatePrintRecords();renderEnrollmentBatchList();renderLogs();renderCensus();if(document.getElementById("print")?.style.display!=="none")renderSelectedPrint()}


function fullName(r){return[r.lastName,r.firstName,r.middleName,r.extensionName].filter(Boolean).join(" ")}
function getFilteredRecords(){
  const q=(document.getElementById("recordsSearch").value||"").trim().toLowerCase(),g=document.getElementById("recordsGradeFilter").value,y=document.getElementById("recordsYearFilter").value,s=document.getElementById("recordsStatusFilter").value,strand=document.getElementById("recordsStrandFilter").value,section=document.getElementById("recordsSectionFilter").value;
  const all=getActiveRecords().slice();
  const years=[...new Set(all.map(x=>x.schoolYear).filter(Boolean))].sort().reverse(),ys=document.getElementById("recordsYearFilter"),old=ys.value;
  ys.innerHTML='<option value="">All School Years</option>'+years.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");if(years.includes(old))ys.value=old;else ys.value=y;
  const strands=[...new Set(all.map(x=>x.strand).filter(Boolean))].sort(),sections=[...new Set(all.map(x=>x.sectionName).filter(Boolean))].sort();
  const strandEl=document.getElementById("recordsStrandFilter"),sectionEl=document.getElementById("recordsSectionFilter"),oldStrand=strandEl.value,oldSection=sectionEl.value;
  strandEl.innerHTML='<option value="">All Clusters / Strands</option>'+strands.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");if(strands.includes(oldStrand))strandEl.value=oldStrand;
  sectionEl.innerHTML='<option value="">All Sections</option>'+sections.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");if(sections.includes(oldSection))sectionEl.value=oldSection;
  const rows=all.filter(r=>{const hay=[fullName(r),r.lrn,r.recordId,r.schoolYear,r.strand,r.sectionName].join(" ").toLowerCase();return(!q||hay.includes(q))&&(!g||String(r.gradeLevel)===g)&&(!ys.value||r.schoolYear===ys.value)&&(!s||r.status===s)&&(!strand||r.strand===strandEl.value)&&(!section||r.sectionName===sectionEl.value)});
  const sortMode=document.getElementById("recordsSortFilter")?.value||"updated-desc";
  const dateValue=(value)=>{const time=new Date(value||0).getTime();return Number.isFinite(time)?time:0};
  rows.sort((a,b)=>{
    if(sortMode==="name-asc"||sortMode==="name-desc"){const result=fullName(a).localeCompare(fullName(b),undefined,{sensitivity:"base",numeric:true});return sortMode==="name-asc"?result:-result;}
    if(sortMode==="enrolled-asc"||sortMode==="enrolled-desc"){const result=dateValue(a.createdAt)-dateValue(b.createdAt);return sortMode==="enrolled-asc"?result:-result;}
    return dateValue(b.updatedAt||b.createdAt)-dateValue(a.updatedAt||a.createdAt);
  });
  return {all,rows};
}
function renderTableSkeleton(body,count=6,columns=10){
  if(!body)return;
  body.setAttribute("aria-busy","true");
  body.innerHTML=Array.from({length:count},()=>`<tr class="table-skeleton-row">${Array.from({length:columns},(_,i)=>`<td><span class="skeleton-line${i===1?" skeleton-line-wide":""}" aria-hidden="true"></span></td>`).join("")}</tr>`).join("");
}
function clearTableSkeleton(body){if(body)body.removeAttribute("aria-busy")}
async function renderRecords(){
  const {all,rows}=getFilteredRecords(),size=Math.max(1,Number(document.getElementById("recordsPageSize")?.value||10)),pages=Math.max(1,Math.ceil(rows.length/size));
  recordsCurrentPage=Math.min(Math.max(1,recordsCurrentPage),pages);const start=(recordsCurrentPage-1)*size,visible=rows.slice(start,start+size);
  document.getElementById("recordsCount").textContent=`${rows.length} matching · ${all.length} active record${all.length===1?"":"s"}`;
  document.getElementById("recordsEmpty").style.display=rows.length?"none":"block";
  const tableBody=document.getElementById("recordsTableBody");
  if(visible.some(r=>r.photoPath))renderTableSkeleton(tableBody,Math.min(size,visible.length),10);
  const photoUrls=await Promise.all(visible.map(r=>r.photoPath?getStudentPhotoUrl(r.photoPath).catch(err=>{console.warn("Record thumbnail unavailable",err);return ""}):Promise.resolve("")));
  tableBody.innerHTML=visible.map((r,i)=>`<tr><td><span class="record-id-link" data-record="${esc(r.recordId)}">${esc(r.recordId)}</span></td><td><div class="record-person-cell">${photoMarkup(photoUrls[i],"record-photo-thumb")}<div><div class="record-name">${esc(fullName(r)||"Unnamed learner")}</div><div class="record-sub">${esc(r.createdBy||"—")}</div></div></div></td><td>${esc(r.lrn||"—")}</td><td>Grade ${esc(r.gradeLevel||"—")}</td><td>${esc(r.strand||"—")}</td><td>${esc(r.sectionName||"—")}</td><td>${esc(r.schoolYear||"—")}</td><td><span class="status-pill">${esc(r.status||"Active")}</span></td><td>${formatTime(r.updatedAt||r.createdAt)}</td><td><div class="row-actions"><button class="table-btn" data-action="view" data-record="${esc(r.recordId)}">View</button>${canWrite()?`<button class="table-btn" data-action="edit" data-record="${esc(r.recordId)}">Edit</button>`:""}${canManageTrash()?`<button class="table-btn danger-table-btn" data-action="trash" data-record="${esc(r.recordId)}">Move to Trash</button>`:""}</div></td></tr>`).join("");
  clearTableSkeleton(tableBody);
  tableBody.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>{const action=b.dataset.action;if(action==="view")openRecord(b.dataset.record);else if(action==="edit")openEditRecord(b.dataset.record);else if(action==="trash")moveToTrash(b.dataset.record)}));
  tableBody.querySelectorAll(".record-id-link").forEach(b=>b.addEventListener("click",()=>openRecord(b.dataset.record)));
  const pageInfo=document.getElementById("recordsPageInfo"),pageNumber=document.getElementById("recordsPageNumber"),prev=document.getElementById("recordsPrevPage"),next=document.getElementById("recordsNextPage");
  if(pageInfo)pageInfo.textContent=rows.length?`Showing ${start+1}–${Math.min(start+size,rows.length)} of ${rows.length} matching records`:"Showing 0 records";
  if(pageNumber)pageNumber.textContent=`Page ${recordsCurrentPage} of ${pages}`;if(prev)prev.disabled=recordsCurrentPage<=1;if(next)next.disabled=recordsCurrentPage>=pages;
}
function csvCell(value){let s=String(value??"");if(/^[\s]*[=+@\-]/.test(s))s="\'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function exportFilteredRecordsCsv(){
  const {rows}=getFilteredRecords();if(!rows.length){showToast("There are no matching records to export.");return}
  const headers=["Record ID","Learner Name","LRN","Grade Level","Cluster / Historical Strand","Section","School Year","Status","Last Updated"];
  const lines=[headers,...rows.map(r=>[r.recordId,fullName(r),r.lrn,r.gradeLevel,r.strand,r.sectionName,r.schoolYear,r.status||"Active",r.updatedAt||r.createdAt].map(v=>v instanceof Date?v.toISOString():v))].map(row=>row.map(csvCell).join(","));
  const blob=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`TNHS-enrollment-records-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showToast(`Exported ${rows.length} matching record${rows.length===1?"":"s"}.`);
}

async function moveToTrash(id){if(!canManageTrash()){showToast("Your account cannot manage Trash.");return}const r=getActiveRecords().find(x=>x.recordId===id);if(!r)return;if(!confirm(`Move ${r.recordId} to Trash?\n\nThe record will be removed from active Enrollment Records and retained in Trash under its school year through the end of that school year. Permanent deletion is handled separately by authorized personnel under the school records-retention policy.`))return;const now=new Date().toISOString();try{await updateDeletedAt(id,now,r.updatedAt);await insertActivity("Moved enrollment record to Trash",id);refreshAllDataViews();showToast("Enrollment record moved to Trash.")}catch(err){console.error(err);alert(`Unable to move the record to Trash. ${err.message||err}`)}}
async function renderTrash(){const body=document.getElementById("trashTableBody"),empty=document.getElementById("trashEmpty"),count=document.getElementById("trashCount"),filter=document.getElementById("trashYearFilter");if(!body)return;const allRows=getTrashRecords().slice().sort((a,b)=>new Date(b.deletedAt)-new Date(a.deletedAt));if(filter){const selected=filter.value,years=[...new Set(allRows.map(r=>r.schoolYear).filter(Boolean))].sort().reverse();filter.innerHTML='<option value="">All School Years</option>'+years.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join("");if(years.includes(selected))filter.value=selected;}const selectedYear=filter?.value||"";const rows=allRows.filter(r=>!selectedYear||String(r.schoolYear||"")===selectedYear);count.textContent=`${rows.length} of ${allRows.length} record${allRows.length===1?"":"s"}`;empty.style.display=rows.length?"none":"block";if(rows.some(r=>r.photoPath))renderTableSkeleton(body,Math.min(rows.length,8),10);const photoUrls=await Promise.all(rows.map(r=>r.photoPath?getStudentPhotoUrl(r.photoPath).catch(err=>{console.warn("Trash thumbnail unavailable",err);return ""}):Promise.resolve("")));body.innerHTML=rows.map((r,i)=>`<tr><td>${esc(r.recordId)}</td><td><div class="record-person-cell">${photoMarkup(photoUrls[i],"record-photo-thumb")}<div><div class="record-name">${esc(fullName(r)||"Unnamed learner")}</div><div class="record-sub">${esc(r.createdBy||"—")}</div></div></div></td><td>${esc(r.lrn||"—")}</td><td>Grade ${esc(r.gradeLevel||"—")}</td><td>${esc(r.strand||"—")}</td><td>${esc(r.sectionName||"—")}</td><td>${esc(r.schoolYear||"—")}</td><td><span class="trash-retention">School-year retention</span></td><td>${formatTime(r.deletedAt)}</td><td><button class="table-btn" data-trash-action="restore" data-record="${esc(r.recordId)}">Restore</button></td></tr>`).join("");clearTableSkeleton(body);body.querySelectorAll("[data-trash-action]").forEach(b=>b.addEventListener("click",()=>restoreFromTrash(b.dataset.record)));}
async function restoreFromTrash(id){if(!canManageTrash()){showToast("Your account cannot manage Trash.");return}const r=getTrashRecords().find(x=>x.recordId===id);if(!r)return;if(!confirm(`Restore ${r.recordId} to Enrollment Records?`))return;try{await updateDeletedAt(id,null,r.updatedAt);await insertActivity("Restored enrollment record",id);refreshAllDataViews();showPage("trash");showToast("Enrollment record restored.")}catch(err){console.error(err);alert(`Unable to restore the record. ${err.message||err}`)}}
["recordsSearch","recordsGradeFilter","recordsYearFilter","recordsStatusFilter","recordsStrandFilter","recordsSectionFilter","recordsSortFilter"].forEach(id=>document.getElementById(id).addEventListener(id==="recordsSearch"?"input":"change",()=>{recordsCurrentPage=1;renderRecords()}));
document.getElementById("trashYearFilter")?.addEventListener("change",()=>renderTrash());
document.getElementById("recordsPageSize")?.addEventListener("change",()=>{recordsCurrentPage=1;renderRecords()});
document.getElementById("recordsPrevPage")?.addEventListener("click",()=>{if(recordsCurrentPage>1){recordsCurrentPage--;renderRecords()}});
document.getElementById("recordsNextPage")?.addEventListener("click",()=>{recordsCurrentPage++;renderRecords()});
document.getElementById("exportRecordsCsv")?.addEventListener("click",exportFilteredRecordsCsv);
function openGradeRecords(grade){showPage("records");const filter=document.getElementById("recordsGradeFilter");if(filter){filter.value=String(grade);recordsCurrentPage=1;renderRecords()}}
[ ["dashboardGrade11Card",11],["dashboardGrade12Card",12] ].forEach(([id,grade])=>{const el=document.getElementById(id);if(!el)return;el.addEventListener("click",()=>openGradeRecords(grade));el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openGradeRecords(grade)}})});

document.getElementById("newEnrollmentFromRecords").addEventListener("click",()=>{resetEnrollment();showPage("enrollment")});

function addressString(a){if(!a)return"—";return[a.house,a.street,a.barangay,a.municipality,a.province,a.zip,a.country].filter(Boolean).join(", ")||"—"}
function detailItem(label,value){return`<div class="detail-item"><span class="label">${esc(label)}</span><div class="value">${esc(value||"—")}</div></div>`}
function detailSection(title,items){return`<section class="detail-section"><h3>${esc(title)}</h3><div class="detail-grid">${items.join("")}</div></section>`}
async function openRecord(id){
  const r=getRecords().find(x=>x.recordId===id);if(!r)return;
  currentRecordId=id;
  const name=fullName(r)||"Unnamed learner";const detailPhotoUrl=r.photoPath?await getStudentPhotoUrl(r.photoPath).catch(err=>{console.warn("Detail photo unavailable",err);return ""}):"";
  document.getElementById("individualRecordView").innerHTML=`<div class="detail-shell">
    <div class="detail-head"><div><h2>${esc(name)}</h2><p>Enrollment record • ${esc(r.schoolYear||"—")} • Grade ${esc(r.gradeLevel||"—")}</p></div><div class="detail-meta"><span class="record-code">${esc(r.recordId)}</span><span class="detail-status status-pill">${esc(r.status||"Active")}</span></div></div>
    <div class="detail-actions"><button class="btn" id="backRecords">Back to Records</button><button class="btn" id="editCurrentRecord">Edit Record</button><button class="btn" id="manageLearnerStatus">Manage Learner Status</button><button class="btn primary" id="printCurrentRecord">Print Form</button></div>
          <section class="detail-section" id="learnerStatusPanel" hidden><h3>Update Learner Status</h3><p class="status-help">Status changes are recorded separately from enrollment edits. A status change does not delete the enrollment record. When newly assigning Transferred in or Balik-Aral, set the status to Active after successful enrollment or return. Later status changes may retain that original classification.</p><div class="status-form-grid"><label>New Status<select id="learnerNewStatus"><option>Active</option><option>Stopped</option><option>Dropped out</option><option>Permanently stopped</option><option>Transferred out</option></select></label><label>Enrollment Classification<select id="learnerClassification"><option>Standard</option><option>Transferred in</option><option>Balik-Aral</option></select></label><label>Effective Date<input id="learnerStatusDate" type="date"></label><label class="status-reason-field">Reason<textarea id="learnerStatusReason" rows="3" maxlength="1000" placeholder="Enter the reason for this status update"></textarea></label></div><div class="detail-actions status-form-actions"><button class="btn primary" id="saveLearnerStatus">Save Status Update</button><button class="btn" id="cancelLearnerStatus">Cancel</button></div><h3>Status History</h3><div id="learnerStatusHistory" class="status-history-list">Loading status history…</div></section>
    <div class="detail-body">
      <div class="detail-photo-card"><strong>Student Photo</strong>${photoMarkup(detailPhotoUrl,"detail-student-photo")}</div>
      ${detailSection("Enrollment & Learner Information",[detailItem("School Year",r.schoolYear),detailItem("Grade Level to Enroll",r.gradeLevel),detailItem("Semester",r.semester),detailItem("Track",r.track),detailItem("Cluster of Electives / Historical Strand",r.strand),detailItem("Section",r.sectionName),detailItem("PSA Birth Certificate No.",r.psa),detailItem("LRN",r.lrn),detailItem("Last Name",r.lastName),detailItem("First Name",r.firstName),detailItem("Middle Name",r.middleName),detailItem("Extension Name",r.extensionName),detailItem("Birthdate",r.birthdate),detailItem("Place of Birth (Municipality/City)",r.placeOfBirth)])}
      ${detailSection("Address Information",[detailItem("Current Address",addressString(r.currentAddress)),detailItem("Permanent Address",r.permanentAddressSame==="Yes"?"Same as current address":addressString(r.permanentAddress)),detailItem("Same as Current Address?",r.permanentAddressSame)])}
      ${detailSection("Parent & Other Learner Information",[detailItem("Father's Name",[r.father?.last,r.father?.first,r.father?.middle].filter(Boolean).join(" ")),detailItem("Father's Contact Number",r.father?.contact),detailItem("Mother's Maiden Name",[r.mother?.last,r.mother?.first,r.mother?.middle].filter(Boolean).join(" ")),detailItem("Mother's Contact Number",r.mother?.contact),detailItem("Age",r.age),detailItem("Mother Tongue",r.motherTongue),detailItem("Returning (Balik-Aral)",r.returning),detailItem("Sex",r.sex),detailItem("IP Community",r.ipCommunity),detailItem("IP Specification",r.ipSpecification),detailItem("4Ps Beneficiary",r.fourPs),detailItem("4Ps Household ID",r.fourPsHouseholdId)])}
      ${detailSection("Guardian & Previous School Information",[detailItem("Guardian's Name",[r.guardian?.last,r.guardian?.first,r.guardian?.middle].filter(Boolean).join(" ")),detailItem("Guardian Contact Number",r.guardian?.contact),detailItem("Last Grade Level Completed",r.lastGradeCompleted),detailItem("Last School Year Completed",r.lastSchoolYear),detailItem("Last School Attended",r.lastSchoolAttended),detailItem("School ID",r.schoolId)])}
      ${detailSection("Learner Status & Enrollment Classification",[detailItem("Current Status",r.status||"Active"),detailItem("Enrollment Classification",r.enrollmentClassification||"Standard"),detailItem("Status Effective Date",r.statusEffectiveDate),detailItem("Status Reason",r.statusReason)])}

      ${detailSection("Certification & Modality",[detailItem("Signature Over Printed Name of Parent/Guardian",r.parentGuardianPrintedName),detailItem("Date",r.certificationDate),detailItem("Preferred Distance Learning Modality/ies",r.modalities?.join(", ")),detailItem("Created",formatTime(r.createdAt)),detailItem("Last Updated",formatTime(r.updatedAt)),detailItem("Created By",r.createdBy)])}
    </div></div>`;
  document.getElementById("recordsListView").style.display="none";document.getElementById("editRecordView").style.display="none";document.getElementById("individualRecordView").style.display="block";
  document.getElementById("backRecords").onclick=()=>{resetModuleViews();renderRecords()};
  document.getElementById("editCurrentRecord").hidden=!canWrite();document.getElementById("editCurrentRecord").onclick=()=>openEditRecord(id);
  const statusBtn=document.getElementById("manageLearnerStatus"),statusPanel=document.getElementById("learnerStatusPanel"),detailBody=document.querySelector("#individualRecordView .detail-body"),detailShell=document.querySelector("#individualRecordView .detail-shell");
  const setStatusMode=(enabled)=>{
    statusPanel.hidden=!enabled;
    statusPanel.style.display=enabled?"block":"none";
    detailBody.hidden=enabled;
    detailBody.style.display=enabled?"none":"";
    detailShell.classList.toggle("status-mode",enabled);
    statusBtn.textContent=enabled?"Back to Learner Details":"Manage Learner Status";
    statusBtn.setAttribute("aria-expanded",String(enabled));
    ["editCurrentRecord","qrCurrentRecord","printCurrentRecord"].forEach(buttonId=>{
      const action=document.getElementById(buttonId);
      if(action) action.hidden=enabled;
    });
    if(enabled){
      document.getElementById("learnerNewStatus").value=r.status||"Active";
      document.getElementById("learnerClassification").value=r.enrollmentClassification||"Standard";
      document.getElementById("learnerStatusDate").value=new Date().toISOString().slice(0,10);
      document.getElementById("learnerStatusReason").value="";
      loadLearnerStatusHistory(id);
      requestAnimationFrame(()=>statusPanel.scrollIntoView({behavior:"smooth",block:"start"}));
    }
  };
  statusBtn.hidden=!canWrite();statusBtn.onclick=()=>setStatusMode(statusPanel.hidden);document.getElementById("cancelLearnerStatus").onclick=()=>setStatusMode(false);document.getElementById("saveLearnerStatus").onclick=()=>saveLearnerStatus(id);
  document.getElementById("printCurrentRecord").onclick=()=>window.dispatchEvent(new CustomEvent("tnhs:print-record",{detail:r}));
  const qrBtn=document.createElement("button");qrBtn.type="button";qrBtn.className="btn";qrBtn.id="qrCurrentRecord";qrBtn.textContent="QR Receipt";qrBtn.onclick=()=>showQrReceipt(r);document.getElementById("printCurrentRecord").parentElement.insertBefore(qrBtn,document.getElementById("printCurrentRecord"));
}
async function loadLearnerStatusHistory(recordId){const target=document.getElementById("learnerStatusHistory");if(!target)return;target.textContent="Loading status history…";try{const {data,error}=await supabaseClient.from("learner_status_history").select("previous_status,new_status,previous_classification,new_classification,effective_date,reason,actor_display_name,created_at").eq("record_id",recordId).order("created_at",{ascending:false});if(error)throw error;if(!data?.length){target.textContent="No status changes recorded yet.";return}target.innerHTML=data.map(x=>`<div class="status-history-item"><strong>${esc(x.previous_status||"—")} → ${esc(x.new_status)}</strong><span>${esc(x.effective_date||"—")} · ${esc(x.actor_display_name||"—")}</span><p>${esc(x.reason||"—")}</p><small>classification: ${esc(x.previous_classification||"Standard")} → ${esc(x.new_classification||"Standard")} · logged ${esc(formatTime(x.created_at))}</small></div>`).join("")}catch(e){console.error("Status history load failed",e);target.textContent="Status history is unavailable. Confirm that the Phase 21 database migration has been applied."}}
async function saveLearnerStatus(recordId){if(!canWrite()){showToast("Your account cannot update learner status.");return}const r=getActiveRecords().find(x=>x.recordId===recordId);if(!r)return;const status=document.getElementById("learnerNewStatus").value,classification=document.getElementById("learnerClassification").value,effectiveDate=document.getElementById("learnerStatusDate").value,reason=document.getElementById("learnerStatusReason").value.trim();if(!effectiveDate){alert("Please provide the effective date.");return}if(!reason){alert("Please provide the reason for the status update.");return}if(status===r.status&&classification===(r.enrollmentClassification||"Standard")){alert("No status or enrollment classification change was selected.");return}const previousClassification=r.enrollmentClassification||"Standard";if(classification!==previousClassification&&["Transferred in","Balik-Aral"].includes(classification)&&status!=="Active"){alert(`A learner newly classified as ${classification} must have Active status after the successful enrollment or return. Select Active, then save the classification.`);return}if(!confirm(`Save learner status update?\n\n${r.status||"Active"} → ${status}\nClassification: ${r.enrollmentClassification||"Standard"} → ${classification}\nEffective date: ${effectiveDate}\n\nThe enrollment record will remain saved.`))return;const btn=document.getElementById("saveLearnerStatus");btn.disabled=true;try{const {data,error}=await supabaseClient.rpc("update_learner_status",{p_record_id:recordId,p_new_status:status,p_new_classification:classification,p_effective_date:effectiveDate,p_reason:reason,p_expected_updated_at:r.updatedAt});if(error)throw error;if(!data)throw new Error("The record was changed by another user. Reload and try again.");const saved=rowToRecord(data);const i=recordsCache.findIndex(x=>x.recordId===recordId);if(i>=0)recordsCache[i]=saved;try{await insertActivity("Updated learner status",recordId,`${r.status||"Active"} → ${status}; classification: ${r.enrollmentClassification||"Standard"} → ${classification}; effective: ${effectiveDate}`)}catch(logError){console.warn("Status saved; supplemental activity log entry failed",logError)}refreshAllDataViews();showToast("Learner status updated and history recorded.");openRecord(recordId)}catch(e){console.error("Learner status update failed",e);alert(`Unable to update learner status. ${e.message||e}. Check whether the Phase 21 migration has been applied.`)}finally{btn.disabled=false}}
function editField(label,id,value,type="text"){const contact=["fatherContact","motherContact","guardianContact"].includes(id);return`<div class="edit-field"><label for="edit_${id}">${esc(label)}</label><input id="edit_${id}" type="${type}" value="${esc(value||"")}"${contact?' inputmode="numeric" maxlength="11" placeholder="09XXXXXXXXX"':''}></div>`}
function editSelect(label,id,value,options){return`<div class="edit-field"><label for="edit_${id}">${esc(label)}</label><select id="edit_${id}">${options.map(o=>`<option value="${esc(o)}" ${String(o)===String(value||"")?"selected":""}>${esc(o||"Select")}</option>`).join("")}</select></div>`}
function editSchoolYearSelect(value){const years=getSchoolYearOptions([value]);return editSelect("School Year","schoolYear",value,["",...years]);}
const SSHS_CLUSTERS={Academic:["STEM","HUMSS","ABM"],TechPro:["ICT","HE","AFA","SMAW"]};
function editTrackSelect(value){const options=["","Academic","TechPro"];if(value&&!options.includes(String(value)))options.push(String(value));return editSelect("Track","track",value,options);}
function editClusterSelect(track,value){const options=["",...(SSHS_CLUSTERS[track]||[])];if(value&&!options.includes(String(value)))options.push(String(value));return editSelect("Strand","strand",value,options);}

function editChecks(label,id,values,selected){return`<div class="edit-field edit-checks"><label>${esc(label)}</label><div class="edit-check-grid">${values.map(v=>`<label class="choice"><input type="checkbox" name="edit_${id}" value="${esc(v)}" ${selected?.includes(v)?"checked":""}> ${esc(v)}</label>`).join("")}</div></div>`}
function openEditRecord(id){
  const r=getRecords().find(x=>x.recordId===id);if(!r)return;currentRecordId=id;
  const father=r.father||{},mother=r.mother||{},guardian=r.guardian||{};
  document.getElementById("editRecordView").innerHTML=`<div class="edit-shell"><div class="edit-head"><h2>Edit Enrollment Record</h2><p>Record ID: ${esc(r.recordId)}. The Record ID remains unchanged after saving.</p></div>
  <div class="edit-body"><div class="edit-grid">
    <div class="edit-group-heading"><span>01</span><div><strong>Enrollment & Learner Information</strong><small>School year, learner identity, and basic details</small></div></div>
    ${editSchoolYearSelect(r.schoolYear)}${editSelect("Grade Level to Enroll","gradeLevel",r.gradeLevel,["","11","12"])}${editField("PSA Birth Certificate No.","psa",r.psa)}${editField("LRN","lrn",r.lrn)}${editField("Last Name","lastName",r.lastName)}${editField("First Name","firstName",r.firstName)}${editField("Middle Name","middleName",r.middleName)}${editField("Extension Name","extensionName",r.extensionName)}${editField("Birthdate","birthdate",r.birthdate,"date")}${editField("Place of Birth (Municipality/City)","placeOfBirth",r.placeOfBirth)}${editSelect("Semester","semester",r.semester,["","1st Sem","2nd Sem"])}${editTrackSelect(r.track)}${editClusterSelect(r.track,r.strand)}${editField("Section","sectionName",r.sectionName)}
    <div class="edit-group-heading"><span>02</span><div><strong>Address Information</strong><small>Current and permanent residence</small></div></div>
    ${editField("Current House No./Street","curHouse",r.currentAddress?.house)}${editField("Current Street Name","curStreet",r.currentAddress?.street)}${editField("Current Barangay","curBarangay",r.currentAddress?.barangay)}${editField("Current Municipality/City","curMunicipality",r.currentAddress?.municipality)}${editField("Current Province","curProvince",r.currentAddress?.province)}${editField("Current Zip Code","curZip",r.currentAddress?.zip)}${editField("Current Country","curCountry",r.currentAddress?.country)}${editSelect("Same as Current Address?","sameAddress",r.permanentAddressSame,["Yes","No"])}
    ${editField("Permanent House No./Street","permHouse",r.permanentAddress?.house)}${editField("Permanent Street Name","permStreet",r.permanentAddress?.street)}${editField("Permanent Barangay","permBarangay",r.permanentAddress?.barangay)}${editField("Permanent Municipality/City","permMunicipality",r.permanentAddress?.municipality)}${editField("Permanent Province","permProvince",r.permanentAddress?.province)}${editField("Permanent Zip Code","permZip",r.permanentAddress?.zip)}
    <div class="edit-group-heading"><span>03</span><div><strong>Parent & Learner Information</strong><small>Parent details, contact numbers, and learner classifications</small></div></div>
    <div class="edit-field"><label class="choice"><input type="checkbox" id="edit_fatherNotProvided" ${father.notProvided?"checked":""}> Father information not provided</label></div>${editField("Father's Last Name","fatherLast",father.last)}${editField("Father's First Name","fatherFirst",father.first)}${editField("Father's Middle Name","fatherMiddle",father.middle)}${editField("Father's Contact Number","fatherContact",father.contact)}<div class="edit-field"><label class="choice"><input type="checkbox" id="edit_motherNotProvided" ${mother.notProvided?"checked":""}> Mother information not provided</label></div>${editField("Mother's Maiden Last Name","motherLast",mother.last)}${editField("Mother's Maiden First Name","motherFirst",mother.first)}${editField("Mother's Maiden Middle Name","motherMiddle",mother.middle)}${editField("Mother's Contact Number","motherContact",mother.contact)}${editField("Age","age",r.age)}${editField("Mother Tongue","motherTongue",r.motherTongue)}
    ${editSelect("Returning (Balik-Aral)","returning",r.returning,["","Yes","No"])}${editSelect("Sex","sex",r.sex,["","Male","Female"])}${editSelect("IP Community","ipCommunity",r.ipCommunity,["","Yes","No"])}${editField("IP Specification","ipSpecification",r.ipSpecification)}${editSelect("4Ps Beneficiary","fourPs",r.fourPs,["","Yes","No"])}${editField("4Ps Household ID","fourPsHouseholdId",r.fourPsHouseholdId)}
    <div class="edit-group-heading"><span>04</span><div><strong>Guardian &amp; Previous School Information</strong><small>Guardian details and previous school records</small></div></div>
    ${editField("Guardian's Last Name","guardianLast",guardian.last)}${editField("Guardian's First Name","guardianFirst",guardian.first)}${editField("Guardian's Middle Name","guardianMiddle",guardian.middle)}${editField("Guardian Contact Number","guardianContact",guardian.contact)}${editField("Last Grade Level Completed","lastGradeCompleted",r.lastGradeCompleted)}${editField("Last School Year Completed","lastSchoolYear",r.lastSchoolYear)}${editField("Last School Attended","lastSchoolAttended",r.lastSchoolAttended)}${editField("School ID","schoolId",r.schoolId)}
    <div class="edit-group-heading"><span>05</span><div><strong>Certification & Learning Modality</strong><small>Parent/guardian certification and applicable modalities</small></div></div>
    ${editField("Parent/Guardian Printed Name","parentGuardianPrintedName",r.parentGuardianPrintedName)}${editField("Certification Date","certificationDate",r.certificationDate,"date")}${editChecks("Preferred Distance Learning Modality/ies","modalities",["Modular (Print)","Online","Radio-Based Instruction","Blended","Modular (Digital)","Educational Television","Homeschooling","Face to Face"],r.modalities||[])}
  </div></div><div class="edit-actions"><button class="btn" id="cancelEdit" type="button">Cancel</button><button class="btn primary" id="saveRecordEdit" type="button">Save Changes</button></div></div>`;
  document.getElementById("recordsListView").style.display="none";document.getElementById("individualRecordView").style.display="none";document.getElementById("editRecordView").style.display="block";
  document.getElementById("cancelEdit").onclick=()=>openRecord(id);document.getElementById("saveRecordEdit").onclick=()=>saveRecordEdit(id);if(!canWrite())document.getElementById("saveRecordEdit").hidden=true;bindCapitalization(document.getElementById("editRecordView"));
  document.getElementById("edit_track")?.addEventListener("change",e=>{const cluster=document.getElementById("edit_strand");if(!cluster)return;const opts=SSHS_CLUSTERS[e.target.value]||[];cluster.innerHTML='<option value="">Select cluster of electives</option>'+opts.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");});
  document.getElementById("edit_sameAddress").addEventListener("change",e=>{const disabled=e.target.value==="Yes";["permHouse","permStreet","permBarangay","permMunicipality","permProvince","permZip"].forEach(k=>document.getElementById("edit_"+k).disabled=disabled);});
  document.getElementById("edit_sameAddress").dispatchEvent(new Event("change"));
  [["edit_fatherNotProvided",["fatherLast","fatherFirst","fatherMiddle","fatherContact"]],["edit_motherNotProvided",["motherLast","motherFirst","motherMiddle","motherContact"]]].forEach(([cid,fields])=>{const c=document.getElementById(cid);const sync=()=>fields.forEach(k=>{const el=document.getElementById("edit_"+k);el.disabled=c.checked;if(c.checked)el.value=""});c.addEventListener("change",sync);sync()});
}
function editVal(id){return document.getElementById("edit_"+id)?.value?.trim()||""}
async function saveRecordEdit(id){
  const r=getActiveRecords().find(x=>x.recordId===id);if(!r)return;
  const newLrn=editVal("lrn");
  if(!/^\d{12}$/.test(newLrn)){alert("LRN must contain exactly 12 digits.");return}
  const editedBirthdate=editVal("birthdate");if(!isValidIsoDate(editedBirthdate)||new Date(`${editedBirthdate}T00:00:00`)>new Date(new Date().toDateString())){alert("Please enter a valid birthdate that is not in the future.");document.getElementById("edit_birthdate")?.focus();return}
  const editedCertificationDate=editVal("certificationDate");if(editedCertificationDate&&!isValidIsoDate(editedCertificationDate)){alert("Please enter a valid certification date.");document.getElementById("edit_certificationDate")?.focus();return}
  for(const [label,key] of [["Father's Contact Number","fatherContact"],["Mother's Contact Number","motherContact"],["Guardian Contact Number","guardianContact"]]){const value=editVal(key);if(value&&!/^09\d{9}$/.test(value)){alert(`${label} must contain exactly 11 digits and start with 09.`);document.getElementById(`edit_${key}`)?.focus();return}}
  const duplicate=getActiveRecords().some(x=>x.recordId!==id&&x.lrn===newLrn&&newLrn);if(duplicate){alert("This LRN is already assigned to another enrollment record.");return}
  const now=new Date().toISOString(),same=editVal("sameAddress")||"No";
  const capEdit=id=>capitalizeWords(editVal(id));
  const updated={...r,schoolYear:editVal("schoolYear"),gradeLevel:editVal("gradeLevel"),psa:editVal("psa"),lrn:newLrn,lastName:capEdit("lastName"),firstName:capEdit("firstName"),middleName:capEdit("middleName"),extensionName:capEdit("extensionName"),birthdate:editVal("birthdate"),placeOfBirth:capEdit("placeOfBirth"),
    currentAddress:{...r.currentAddress,house:capEdit("curHouse"),street:capEdit("curStreet"),barangay:capEdit("curBarangay"),municipality:capEdit("curMunicipality"),province:capEdit("curProvince"),zip:editVal("curZip"),country:capEdit("curCountry")},
    permanentAddressSame:same,permanentAddress:{house:capEdit("permHouse"),street:capEdit("permStreet"),barangay:capEdit("permBarangay"),municipality:capEdit("permMunicipality"),province:capEdit("permProvince"),zip:editVal("permZip")},
    father:{last:capEdit("fatherLast"),first:capEdit("fatherFirst"),middle:capEdit("fatherMiddle"),contact:editVal("fatherContact"),notProvided:!!document.getElementById("edit_fatherNotProvided")?.checked},mother:{last:capEdit("motherLast"),first:capEdit("motherFirst"),middle:capEdit("motherMiddle"),contact:editVal("motherContact"),notProvided:!!document.getElementById("edit_motherNotProvided")?.checked},age:editVal("age"),motherTongue:capEdit("motherTongue"),returning:editVal("returning"),sex:editVal("sex"),ipCommunity:editVal("ipCommunity"),ipSpecification:capEdit("ipSpecification"),fourPs:editVal("fourPs"),fourPsHouseholdId:editVal("fourPsHouseholdId"),
    guardian:{last:capEdit("guardianLast"),first:capEdit("guardianFirst"),middle:capEdit("guardianMiddle"),contact:editVal("guardianContact")},lastGradeCompleted:editVal("lastGradeCompleted"),lastSchoolYear:editVal("lastSchoolYear"),lastSchoolAttended:capEdit("lastSchoolAttended"),schoolId:editVal("schoolId"),semester:editVal("semester"),track:editVal("track"),strand:editVal("strand"),sectionName:editVal("sectionName"),parentGuardianPrintedName:capEdit("parentGuardianPrintedName"),certificationDate:editVal("certificationDate"),modalities:[...document.querySelectorAll('input[name="edit_modalities"]:checked')].map(x=>x.value),updatedAt:now};
  if(same==="Yes")updated.permanentAddress={...updated.currentAddress};
  const btn=document.getElementById("saveRecordEdit");if(btn)btn.disabled=true;
  try{const saved=await updateEnrollment(id,updated,r.updatedAt);await insertActivity("Updated enrollment record",id);lastSavedRecord=saved;refreshAllDataViews();showToast("Enrollment record updated.");openRecord(id)}catch(err){console.error(err);if(err.code==="CONCURRENT_EDIT"){try{await loadRemoteData();refreshAllDataViews()}catch(refreshError){console.error(refreshError)}}alert(`Unable to update the record. ${err.message||err}`)}finally{if(btn)btn.disabled=false}
}
function showToast(msg){const t=document.getElementById("toast");if(!t)return;t.textContent=msg;t.style.display="block";clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.style.display="none",2500)}


/* 13G — Print / Generate */
function populatePrintRecords(){
 const sel=document.getElementById("printRecordSelect"),records=getActiveRecords().slice().sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt)),selected=sel.value;
 sel.innerHTML='<option value="">Select an enrollment record</option>'+records.map(r=>`<option value="${esc(r.recordId)}">${esc(r.recordId)} — ${esc(fullName(r)||"Unnamed learner")} — Grade ${esc(r.gradeLevel||"—")}</option>`).join("");
 if(records.some(r=>r.recordId===selected))sel.value=selected;
}

/* Phase 29.3 — isolated batch enrollment form selection and printing. */
let enrollmentBatchSelection=new Set();
function getPrintEligibleRecords(){return getActiveRecords().slice().sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));}
function renderEnrollmentBatchList(){
 const host=document.getElementById("enrollmentBatchList");if(!host)return;
 const records=getPrintEligibleRecords();
 enrollmentBatchSelection=new Set([...enrollmentBatchSelection].filter(id=>records.some(r=>r.recordId===id)));
 if(!records.length){host.innerHTML='<p class="enrollment-batch-empty">No active enrollment records available.</p>';}
 else host.innerHTML=records.map(r=>`<label class="enrollment-batch-item"><input type="checkbox" class="enrollment-batch-check" value="${esc(r.recordId)}" ${enrollmentBatchSelection.has(r.recordId)?"checked":""}><span><strong>${esc(fullName(r)||"Unnamed learner")}</strong><small>${esc(r.recordId)} · Grade ${esc(r.gradeLevel||"—")} · ${esc(r.schoolYear||"—")}</small></span></label>`).join("");
 host.querySelectorAll(".enrollment-batch-check").forEach(input=>input.addEventListener("change",()=>{if(input.checked)enrollmentBatchSelection.add(input.value);else enrollmentBatchSelection.delete(input.value);updateEnrollmentBatchCount()}));
 updateEnrollmentBatchCount();
}
function updateEnrollmentBatchCount(){const count=document.getElementById("enrollmentBatchCount");if(count)count.textContent=`${enrollmentBatchSelection.size} selected`;const preview=document.getElementById("previewEnrollmentBatch"),print=document.getElementById("printEnrollmentBatch");if(preview)preview.disabled=!enrollmentBatchSelection.size;if(print)print.disabled=!enrollmentBatchSelection.size;}
function selectedEnrollmentBatchRecords(){const byId=new Map(getPrintEligibleRecords().map(r=>[r.recordId,r]));return [...enrollmentBatchSelection].map(id=>byId.get(id)).filter(Boolean)}
document.getElementById("selectAllEnrollmentBatch")?.addEventListener("click",()=>{enrollmentBatchSelection=new Set(getPrintEligibleRecords().map(r=>r.recordId));renderEnrollmentBatchList()});
document.getElementById("clearEnrollmentBatch")?.addEventListener("click",()=>{enrollmentBatchSelection.clear();renderEnrollmentBatchList()});
async function buildEnrollmentBatchMarkup(records){
 const pages=[];
 for(const record of records){let photoUrl="";if(record.photoPath){try{photoUrl=await getStudentPhotoUrl(record.photoPath)}catch(error){console.warn("Batch enrollment photo unavailable",record.recordId,error)}}pages.push(makeBEEFOnePage(record,photoUrl));}
 return pages.join("");
}
async function previewEnrollmentBatch(){
 const records=selectedEnrollmentBatchRecords();if(!records.length){alert("Select at least one enrollment record.");return false}
 const preview=document.getElementById("printPreview");
 try{preview.innerHTML=await buildEnrollmentBatchMarkup(records);document.body.classList.add("enrollment-batch-preview");showToast(`${records.length} enrollment form(s) ready for preview.`);return true}
 catch(error){console.error("Batch enrollment preview failed",error);alert("The selected enrollment forms could not be prepared. Please try again.");return false}
}
document.getElementById("previewEnrollmentBatch")?.addEventListener("click",previewEnrollmentBatch);
async function printEnrollmentBatch(){
 const records=selectedEnrollmentBatchRecords();if(!records.length){alert("Select at least one enrollment record.");return}
 const button=document.getElementById("printEnrollmentBatch");if(button)button.disabled=true;
 try{
  const ready=await previewEnrollmentBatch();if(!ready)return;
  await waitForPrintAssets();
  document.body.classList.add("printing-enrollment-batch");
  records.forEach(record=>insertActivity("Batch printed one-page Legal enrollment form",record.recordId).catch(error=>console.error("Unable to record batch print activity",record.recordId,error)));
  const cleanup=()=>{document.body.classList.remove("printing-enrollment-batch");window.removeEventListener("afterprint",cleanup);renderSelectedPrint();};
  window.addEventListener("afterprint",cleanup,{once:true});
  window.print();
  setTimeout(cleanup,120000);
 }catch(error){document.body.classList.remove("printing-enrollment-batch");console.error("Batch enrollment printing failed",error);alert("The selected enrollment forms could not be prepared for printing. Please try again.")}
 finally{if(button)button.disabled=false}
}
document.getElementById("printEnrollmentBatch")?.addEventListener("click",printEnrollmentBatch);
function beefEsc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]))}
function beefSvgText(x,y,w,value,{size=11,weight=600,anchor="start",italic=false}={}){
 const t=String(value??"").trim().toUpperCase();if(!t)return "";
 const approx=Math.max(1,t.length*size*.56),fit=Math.max(6.2,Math.min(size,size*w/approx));
 return `<text x="${x}" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="${fit.toFixed(2)}" font-weight="${weight}" text-anchor="${anchor}"${italic?' font-style="italic"':''}>${beefEsc(t)}</text>`;
}
function beefSvgLine(x1,y1,x2,y2,sw=1){return `<path d="M ${x1} ${y1} H ${x2}" fill="none" stroke="#111" stroke-width="${sw}" stroke-linecap="butt" vector-effect="non-scaling-stroke" shape-rendering="crispEdges"/>`}
function beefSvgRect(x,y,w,h,fill="#fff",sw=1){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="#111" stroke-width="${sw}"/>`}
function beefSvgSection(y,label){return `${beefSvgRect(72,y,703,20,"#e8e8e8",.8)}${beefSvgText(423.5,y+14,690,label,{size:10,weight:700,anchor:"middle"})}`}
function beefSvgField(x,y,w,h,label,value,{size=10,box=false,center=false}={}){
 let out=beefSvgRect(x,y,w,h,"#fff",.8)+beefSvgText(x+4,y+9,w-8,label,{size:7.3,weight:600});
 if(value!==undefined&&value!==null&&String(value)!=="")out+=beefSvgText(center?x+w/2:x+5,y+h-7,w-10,String(value),{size,weight:600,anchor:center?"middle":"start"});
 return out;
}
function beefSvgChars(x,y,w,h,value,count=null,expandForValue=false){
 const raw=String(value??"").toUpperCase();
 
 
 const baseCount=count||Math.max(raw.length,1);
 const n=expandForValue&&raw.length>baseCount?raw.length:baseCount;
 const cw=w/n;let out="";
 for(let i=0;i<n;i++){
  out+=beefSvgRect(x+i*cw,y,cw,h,"#fff",.65);
  if(raw[i])out+=beefSvgText(x+(i+.5)*cw,y+h-6,cw-1,raw[i],{size:10,weight:600,anchor:"middle"});
 }
 return out;
}
function beefSvgCheck(x,y,label,on,labelWidth=72){return `${beefSvgRect(x,y,9,9,"#fff",.8)}${on?`<path d="M ${x+1.5} ${y+4.8} L ${x+3.8} ${y+7.2} L ${x+7.8} ${y+1.8}" fill="none" stroke="#111" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`:""}${beefSvgText(x+14,y+8,labelWidth,label,{size:8.5})}`}
function beefSvgPerson(y,title,p={}){
 let out=beefSvgText(86,y,500,title,{size:8.5,weight:700});
 const cols=[[86,159,"Last Name","last"],[258,159,"First Name","first"],[430,159,"Middle Name","middle"],[602,143,"Contact Number","contact"]];
 cols.forEach(([x,w,l,k])=>{out+=beefSvgRect(x,y+9,w,39,"#fff",.8)+beefSvgText(x+4,y+18,w-8,l,{size:7.2,weight:600})+beefSvgText(x+4,y+39,w-8,p[k],{size:10})});return out;
}
function makeBEEF(r,photoUrl=""){
 const cur=r.currentAddress||{},perm=r.permanentAddress||{},father=r.father||{},mother=r.mother||{},guardian=r.guardian||{};
 const same=String(r.permanentAddressSame||"").toLowerCase()==="yes";
 const yes=v=>String(v||"").toLowerCase()==="yes";
 const mods=(r.modalities||[]).map(x=>String(x).toLowerCase());
 const has=(v)=>mods.includes(v.toLowerCase());
 let a=[];
 
 a.push(`<image href="assets/beef-template/deped-seal.png" x="120" y="65" width="82" height="82" preserveAspectRatio="xMidYMid meet"/>`);
 a.push(beefSvgText(405,88,370,"TALUGTUG NATIONAL HIGH SCHOOL – MAIN",{size:10.2,weight:700,anchor:"middle"}));
 a.push(beefSvgText(405,106,370,"ENHANCED BASIC EDUCATION ENROLLMENT FORM",{size:12.2,weight:700,anchor:"middle"}));
 a.push(beefSvgText(405,119,230,"THIS FORM IS NOT FOR SALE.",{size:7.5,weight:600,anchor:"middle"}));
 
 a.push(`<rect x="598" y="10" width="204" height="204" fill="#fff" stroke="#111" stroke-width="1.2"/>${photoUrl?`<image href="${beefEsc(photoUrl)}" x="600" y="12" width="200" height="200" preserveAspectRatio="xMidYMid slice"/>`:""}`);
 a.push(beefSvgRect(724,217,56,15,"#fff",.8)+beefSvgText(752,228,50,"ANNEX 1",{size:7.5,weight:700,anchor:"middle"}));
 a.push(beefSvgText(88,174,50,"School Year",{size:7,weight:600}));
 const sy=String(r.schoolYear||"").split(/[-–]/);a.push(beefSvgChars(143,157,58,20,sy[0]||"",4)+beefSvgText(207,172,10,"-",{size:10,weight:700,anchor:"middle"})+beefSvgChars(216,157,57,20,sy[1]||"",4));
 a.push(beefSvgText(88,198,78,"Grade level to Enroll:",{size:7,weight:600})+beefSvgChars(172,181,30,20,r.gradeLevel||"",2));
 a.push(beefSvgRect(310,150,280,62,"#fff",.9)+beefSvgText(318,162,250,"Check the appropriate box only",{size:7.6,weight:600}));
 const withLrnAnswer=String(r.lrn??"").trim()?"Yes":"No"; // Annex 1: determine this checkbox from the LRN field only.
 a.push(beefSvgText(320,185,78,"1. With LRN?",{size:7.7,weight:600})+beefSvgCheck(405,175,"Yes",yes(withLrnAnswer))+beefSvgCheck(455,175,"No",String(withLrnAnswer).toLowerCase()==="no"));
 a.push(beefSvgText(320,205,135,"2. Returning (Balik-Aral)",{size:7.4,weight:600})+beefSvgCheck(462,195,"Yes",yes(r.returning))+beefSvgCheck(512,195,"No",String(r.returning).toLowerCase()==="no"));
 a.push(beefSvgText(88,222,100,"INSTRUCTIONS:",{size:8,weight:700}));
 
 a.push(beefSvgText(116,237,660,"Enter all required information accurately and completely in the computerized enrollment system.",{size:8.1,weight:600,italic:true}));
 a.push(beefSvgText(116,252,660,"Review the information for accuracy before submitting and generating the printable enrollment record.",{size:8.1,weight:600,italic:true}));
 
 a.push('<g transform="translate(0 20)">');
 
 a.push(beefSvgRect(57,245,733,819,"#fff",1.5));a.push(beefSvgSection(249,"LEARNER INFORMATION"));
 a.push(beefSvgText(88,288,210,"PSA Birth Certificate No. (if available upon registration)",{size:6.6,weight:600})+beefSvgLine(301,293,468,293,.8)+beefSvgText(325,288,135,r.psa,{size:9}));
 a.push(beefSvgText(477,288,105,"Learner Reference No. (LRN)",{size:6.2,weight:600})+beefSvgChars(588,275,172,20,r.lrn,12));
 a.push(beefSvgText(90,312,80,"Last Name",{size:8,weight:600})+beefSvgChars(100,318,288,20,r.lastName,17,true));
 a.push(beefSvgText(402,312,145,"Birthdate (mm/dd/yyyy)",{size:7,weight:600}));
 let bd=String(r.birthdate||"");if(/^\d{4}-\d{2}-\d{2}$/.test(bd)){const [yy,mm,dd]=bd.split("-");bd=`${mm}/${dd}/${yy}`}else if(/^\d{2}\/\d{2}\/\d{4}$/.test(bd)){};
 const bdDigits=bd.replace(/\D/g,"");
 a.push(beefSvgChars(402,318,34,20,bdDigits.slice(0,2),2)+beefSvgText(441,333,8,"/",{size:10,weight:700,anchor:"middle"})+beefSvgChars(451,318,34,20,bdDigits.slice(2,4),2)+beefSvgText(490,333,8,"/",{size:10,weight:700,anchor:"middle"})+beefSvgChars(495,318,64,20,bdDigits.slice(4,8),4));
 a.push(beefSvgText(560,304,180,"Place of Birth (Municipality/City)",{size:7.5,weight:600})+beefSvgRect(560,310,185,40,"#fff",.8)+beefSvgText(565,331,175,r.placeOfBirth,{size:10}));
 a.push(beefSvgText(90,357,80,"First Name",{size:8,weight:600})+beefSvgChars(100,363,288,20,r.firstName,17,true));
 a.push(beefSvgText(402,357,30,"Sex",{size:8,weight:600})+beefSvgCheck(435,345,"Male",String(r.sex||"").toLowerCase()==="male")+beefSvgCheck(435,365,"Female",String(r.sex||"").toLowerCase()==="female"));
 a.push(beefSvgText(503,357,35,"Age",{size:8,weight:600})+beefSvgRect(503,363,43,39,"#fff",.8)+beefSvgText(524,387,35,r.age,{size:11,anchor:"middle"}));
 a.push(beefSvgText(560,357,100,"Mother Tongue",{size:8,weight:600})+beefSvgRect(560,363,185,39,"#fff",.8)+beefSvgText(565,387,175,r.motherTongue,{size:10}));
 a.push(beefSvgText(90,401,100,"Middle Name",{size:8,weight:600})+beefSvgChars(100,407,288,20,r.middleName,17,true));
 a.push(beefSvgText(90,438,140,"Extension Name e.g. Jr., III (if applicable)",{size:7.5,weight:600})+beefSvgChars(100,444,130,20,r.extensionName,8));
 a.push(beefSvgText(403,409,350,"Do you belong to any Indigenous Peoples (IP) Community/Indigenous Cultural Community?",{size:8,weight:600})+beefSvgCheck(404,414,"Yes",yes(r.ipCommunity))+beefSvgCheck(451,414,"No",!yes(r.ipCommunity)&&!!r.ipCommunity)+beefSvgText(507,430,240,"If yes, please specify:",{size:7.5,weight:600})+beefSvgLine(603,433,745,433,.8)+beefSvgText(606,429,136,r.ipSpecification,{size:9}));
 a.push(beefSvgText(403,449,170,"Is your family a beneficiary of 4Ps?",{size:8,weight:600})+beefSvgCheck(578,438,"Yes",yes(r.fourPs))+beefSvgCheck(623,438,"No",!yes(r.fourPs)&&!!r.fourPs));
 a.push(beefSvgText(416,461,330,"If yes, enter the 4Ps Household ID number below",{size:7.5,weight:600,italic:true})+beefSvgChars(430,463,315,18,r.fourPsHouseholdId,16));
 
 a.push(beefSvgSection(483,"Current Address"));
 a.push(beefSvgField(86,506,143,39,"House No./Street",cur.house)+beefSvgField(244,506,245,39,"Street Name",cur.street)+beefSvgField(503,506,243,39,"Barangay",cur.barangay));
 a.push(beefSvgField(86,550,201,39,"Municipality/City",cur.municipality)+beefSvgField(301,550,187,39,"Province",cur.province)+beefSvgField(503,550,113,39,"Country",cur.country)+beefSvgField(632,550,113,39,"Zip Code",cur.zip));
 a.push(beefSvgRect(72,592,703,20,"#e8e8e8",.8)+beefSvgText(86,606,130,"Permanent Address",{size:8,weight:700})+beefSvgText(188,606,135,"Same with your Current Address?",{size:7.5,weight:600})+beefSvgCheck(333,595,"Yes",same)+beefSvgCheck(380,595,"No",!same&&!!r.permanentAddressSame));
 const pa=same?cur:perm;
 a.push(beefSvgField(86,614,143,39,"House No./Street",pa.house)+beefSvgField(244,614,245,39,"Street Name",pa.street)+beefSvgField(503,614,243,39,"Barangay",pa.barangay));
 a.push(beefSvgField(86,658,201,39,"Municipality/City",pa.municipality)+beefSvgField(301,658,187,39,"Province",pa.province)+beefSvgField(503,658,113,39,"Country",pa.country||cur.country)+beefSvgField(632,658,113,39,"Zip Code",pa.zip));
 a.push(beefSvgSection(706,"PARENT'S/GUARDIAN'S INFORMATION"));
 a.push(beefSvgPerson(739,"Father's Name",father)+beefSvgPerson(798,"Mother's Maiden Name",mother)+beefSvgPerson(857,"Guardian's Name",guardian));
 a.push(beefSvgSection(914,"For Returning Learner (Balik-Aral) and Those Who will Transfer/Move In"));
 a.push(beefSvgText(90,947,130,"Last Grade Level Completed",{size:7.8,weight:600})+beefSvgLine(205,954,431,954,.8)+beefSvgText(230,947,195,r.lastGradeCompleted,{size:9.5}));
 a.push(beefSvgText(460,947,130,"Last School Year Completed",{size:7.8,weight:600})+beefSvgLine(578,954,745,954,.8)+beefSvgText(610,947,135,r.lastSchoolYear,{size:9.5}));
 a.push(beefSvgText(90,979,110,"Last School Attended",{size:7.8,weight:600})+beefSvgLine(202,984,588,984,.8)+beefSvgText(250,979,330,r.lastSchoolAttended,{size:9.5}));
 a.push(beefSvgText(605,979,45,"School ID",{size:7.8,weight:600})+beefSvgChars(659,964,86,20,r.schoolId,6));
 a.push(beefSvgSection(996,"For Learners in Senior High School"));
 a.push(beefSvgText(88,1034,60,"Semester",{size:8,weight:600})+beefSvgCheck(147,1022,"1st Sem",String(r.semester||"").toLowerCase().includes("1st"))+beefSvgCheck(204,1022,"2nd Sem",String(r.semester||"").toLowerCase().includes("2nd")));
 a.push(beefSvgText(274,1034,45,"Track",{size:8,weight:600})+beefSvgLine(315,1037,745,1037,.8)+beefSvgText(319,1033,420,r.track,{size:10}));
 a.push(beefSvgText(274,1056,45,"Strand",{size:8,weight:600})+beefSvgLine(315,1059,745,1059,.8)+beefSvgText(319,1055,420,r.strand,{size:10}));
 a.push('</g>');
 const page1=`<svg class="beef-svg-page" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 827 1170" role="img" aria-label="Enhanced BEEF page 1">${a.join("")}</svg>`;
 let b=[];
 b.push(beefSvgRect(57,63,733,209,"#fff",1.5));b.push(beefSvgSection(77,"Preferred Distance Learning Modality/ies"));
 b.push(beefSvgText(92,105,250,"Choose all that apply.",{size:8,weight:600,italic:true}));
 
 const modItems=[[104,119,"Modular (Print)","modular (print)",112],[278,119,"Online","online",105],[448,119,"Radio-Based Instruction","radio-based instruction",160],[650,119,"Blended","blended",75],[104,145,"Modular (Digital)","modular (digital)",125],[278,145,"Educational Television","educational television",155],[448,145,"Homeschooling","homeschooling",125],[650,145,"Face to Face","face to face",85]];
 modItems.forEach(([x,y,label,key,width])=>{b.push(beefSvgCheck(x,y,label,has(key),width))});
 b.push(beefSvgText(88,177,650,"I hereby certify that the above information given are true and correct to the best of my knowledge and I allow the Department of Education to use my child’s details to",{size:7.5,weight:600,italic:true}));
 b.push(beefSvgText(88,188,650,"create and/or update his/her learner profile in the Learner Information System. The information herein shall be treated as confidential in compliance with the Data Privacy Act of",{size:7.5,weight:600,italic:true}));
 b.push(beefSvgText(88,199,40,"2012.",{size:7.5,weight:600,italic:true}));
 b.push(beefSvgLine(86,245,445,245,.8)+beefSvgLine(473,245,732,245,.8));
 b.push(beefSvgText(265,255,300,"Signature Over Printed Name of Parent/Guardian",{size:8,weight:600,anchor:"middle"})+beefSvgText(603,255,200,"Date",{size:8,weight:600,anchor:"middle"}));
 b.push(beefSvgText(265,237,350,r.parentGuardianPrintedName,{size:10,anchor:"middle"})+beefSvgText(603,237,250,r.certificationDate,{size:10,anchor:"middle"}));
 const page2=`<svg class="beef-svg-page" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 827 1170" role="img" aria-label="Enhanced BEEF page 2">${b.join("")}</svg>`;
 return `<div class="beef-page beef-page-original">${page1}</div><div class="beef-page beef-page-original">${page2}</div>`;
}


function makeBEEFOnePage(r,photoUrl=""){
 const original=makeBEEF(r,photoUrl);
 const pages=[...original.matchAll(/<svg\b[^>]*>([\s\S]*?)<\/svg>/g)];
 if(pages.length!==2)throw new Error("Enhanced BEEF prototype expected exactly two source pages.");
 
 
 const page2=pages[1][1].replace(/font-size="7\.50"/g,'font-size="8.10"');
 const combined=`<svg class="beef-svg-page beef-svg-onepage" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 827 1362" role="img" aria-label="Enhanced BEEF one-page Legal prototype"><g transform="translate(-10 0)">${pages[0][1]}</g><g transform="translate(-10 1055)">${page2}</g></svg>`;
 return `<div class="beef-page beef-page-onepage">${combined}</div>`;
}

async function renderSelectedPrint(){
 document.body.classList.remove("enrollment-batch-preview");
 const id=document.getElementById("printRecordSelect").value,r=getRecords().find(x=>x.recordId===id),preview=document.getElementById("printPreview");
 if(!r){preview.innerHTML='<div class="print-empty"><strong>No record selected</strong>Select an enrollment record above to preview the one-page Legal Enhanced BEEF form.</div>';return false}
 let photoUrl="";
 if(r.photoPath){try{photoUrl=await getStudentPhotoUrl(r.photoPath)}catch(err){console.warn("Enrollment PDF photo unavailable",err)}}
 preview.innerHTML=makeBEEFOnePage(r,photoUrl);
 return true;
}
async function waitForPrintAssets(){
 if(document.fonts?.ready)await document.fonts.ready;
 const images=[...document.querySelectorAll("#printPreview img")];
 const svgImages=[...document.querySelectorAll("#printPreview svg image")];
 await Promise.all([...images.map(img=>{
  if(img.complete)return Promise.resolve();
  return new Promise(resolve=>{img.addEventListener("load",resolve,{once:true});img.addEventListener("error",resolve,{once:true});setTimeout(resolve,2500)});
 }),...svgImages.map(img=>new Promise(resolve=>{
  let done=false;const finish=()=>{if(!done){done=true;resolve()}};
  img.addEventListener("load",finish,{once:true});img.addEventListener("error",finish,{once:true});setTimeout(finish,2500);
 }))]);
}
async function printSelectedEnrollment(id){
 const button=document.getElementById("printBEEFButton");
 if(!id){alert("Select an enrollment record first.");return}
 if(button)button.disabled=true;
 try{
  document.getElementById("printRecordSelect").value=id;
  const ready=await renderSelectedPrint();
  if(!ready)return;
  await waitForPrintAssets();
  insertActivity("Generated / printed one-page Legal enrollment form",id).catch(err=>console.error("Unable to record print activity",err));
  window.print();
 }catch(error){console.error("Enrollment form print failed",error);alert("The one-page Legal enrollment form could not be prepared for printing. Please try again.")}
 finally{if(button)button.disabled=false}
}

document.getElementById("printRecordSelect").addEventListener("change",renderSelectedPrint);
document.getElementById("printBEEFButton").addEventListener("click",()=>printSelectedEnrollment(document.getElementById("printRecordSelect").value));
window.addEventListener("tnhs:print-record",e=>{
 const id=e.detail?.recordId;if(!id)return;
 showPage("print");printSelectedEnrollment(id);
});


let qrLibraryPromise=null;
function loadQrLibrary(){
 if(typeof QRCode!=="undefined")return Promise.resolve(true);
 if(qrLibraryPromise)return qrLibraryPromise;
 qrLibraryPromise=new Promise(resolve=>{
  const script=document.createElement("script");
  script.src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";
  script.async=true;
  script.onload=()=>resolve(typeof QRCode!=="undefined");
  script.onerror=()=>resolve(false);
  document.head.appendChild(script);
 });
 return qrLibraryPromise;
}
async function showQrReceipt(record){
 const modal=document.getElementById("qrReceiptModal"),box=document.getElementById("qrReceiptCode");
 if(!record||!record.recordId)return;
 document.getElementById("qrReceiptLearner").textContent=fullName(record)||"Unnamed learner";
 document.getElementById("qrReceiptRecordId").textContent=record.recordId;
 document.getElementById("qrReceiptSchoolYear").textContent=`School Year ${record.schoolYear||"—"} · Grade ${record.gradeLevel||"—"}`;
 box.innerHTML="<span>Loading QR generator…</span>";
 modal.hidden=false;modal.dataset.recordId=record.recordId;
 const loaded=await loadQrLibrary();
 if(!loaded){box.textContent="QR generator unavailable. Check your internet connection and try again.";showToast("QR generator unavailable. Enrollment and login remain available.");return}
 box.innerHTML="";
 new QRCode(box,{text:`TNHS-CES|${record.recordId}`,width:220,height:220,colorDark:"#142b4a",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});
}
function closeQrReceipt(){document.getElementById("qrReceiptModal").hidden=true}
document.getElementById("qrReceiptClose").addEventListener("click",closeQrReceipt);
document.getElementById("qrReceiptModal").addEventListener("click",e=>{if(e.target.id==="qrReceiptModal")closeQrReceipt()});
document.getElementById("qrReceiptDownload").addEventListener("click",()=>{
 const box=document.getElementById("qrReceiptCode"),canvas=box.querySelector("canvas"),img=box.querySelector("img");let url="";
 if(canvas)url=canvas.toDataURL("image/png");else if(img)url=img.src;
 if(!url){showToast("QR code is not ready yet.");return}
 const a=document.createElement("a");a.href=url;a.download=`TNHS-${modalRecordId()}-QR.png`;a.click();
});
function modalRecordId(){return document.getElementById("qrReceiptModal").dataset.recordId||"Enrollment"}
document.getElementById("qrReceiptPrint").addEventListener("click",()=>{
 const recordId=modalRecordId(),box=document.getElementById("qrReceiptCode"),canvas=box.querySelector("canvas"),img=box.querySelector("img"),qr=canvas?canvas.toDataURL("image/png"):img?.src;
 if(!qr){showToast("QR code is not ready yet.");return}
 const learner=document.getElementById("qrReceiptLearner").textContent,schoolYear=document.getElementById("qrReceiptSchoolYear").textContent;
 const w=window.open("","_blank","width=520,height=680");if(!w){showToast("Allow pop-ups to print the QR receipt.");return}
 w.document.write(`<!doctype html><html><head><title>TNHS QR Receipt</title><style>body{font:16px Arial,sans-serif;text-align:center;padding:36px;color:#142b4a}img{width:220px;height:220px;margin:24px auto}small{display:block;color:#667085;margin-top:28px;line-height:1.5}</style></head><body><h2>TALUGTUG NATIONAL HIGH SCHOOL</h2><h3>ENROLLMENT QR RECEIPT</h3><p>${esc(learner)}</p><img src="${qr}"><h3>${esc(recordId)}</h3><p>${esc(schoolYear)}</p><small>QR contains the Record ID only. Present this receipt to authorized enrollment personnel.</small><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
});
document.getElementById("qrLookupToggle").addEventListener("click",()=>{const panel=document.getElementById("qrLookupPanel");panel.hidden=!panel.hidden;if(!panel.hidden)document.getElementById("qrRecordIdInput").focus()});
function openRecordFromQrInput(){let value=document.getElementById("qrRecordIdInput").value.trim();value=value.replace(/^TNHS-CES\|/i,"").trim();if(!value){showToast("Scan a QR code or enter a Record ID.");return}const found=getActiveRecords().find(r=>r.recordId.toLowerCase()===value.toLowerCase());if(!found){showToast("No active enrollment record matches that QR Record ID.");return}document.getElementById("qrRecordIdInput").value="";openRecord(found.recordId)}
document.getElementById("qrLookupOpen").addEventListener("click",openRecordFromQrInput);
document.getElementById("qrRecordIdInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();openRecordFromQrInput()}});


let qrScanStream=null,qrScanFrame=0,qrScanDetector=null,qrScanJsqrPromise=null,qrScanBusy=false;
const qrScanVideo=document.getElementById("qrScannerVideo"),qrScanModal=document.getElementById("qrScannerModal"),qrScanStatus=document.getElementById("qrScannerStatus");
function setQrScanStatus(message){if(qrScanStatus)qrScanStatus.textContent=message}
function loadJsQr(){
 if(typeof jsQR==="function")return Promise.resolve(true);
 if(qrScanJsqrPromise)return qrScanJsqrPromise;
 qrScanJsqrPromise=new Promise(resolve=>{const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";script.async=true;script.onload=()=>resolve(typeof jsQR==="function");script.onerror=()=>resolve(false);document.head.appendChild(script)});
 return qrScanJsqrPromise;
}
async function stopQrCamera(){
 if(qrScanFrame)cancelAnimationFrame(qrScanFrame);qrScanFrame=0;qrScanBusy=false;
 if(qrScanStream){qrScanStream.getTracks().forEach(track=>track.stop());qrScanStream=null}
 if(qrScanVideo){qrScanVideo.pause();qrScanVideo.srcObject=null}
 const stop=document.getElementById("qrScannerStop");if(stop)stop.disabled=true;
}
async function startQrCamera(deviceId=""){
 await stopQrCamera();
 if(!navigator.mediaDevices?.getUserMedia){setQrScanStatus("Camera access is not available in this browser. Use HTTPS or enter the Record ID manually.");return}
 try{
  const constraints={audio:false,video:deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}};
  qrScanStream=await navigator.mediaDevices.getUserMedia(constraints);
  qrScanVideo.srcObject=qrScanStream;await qrScanVideo.play();
  const select=document.getElementById("qrScannerCameraSelect"),devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==="videoinput");
  const previous=deviceId||qrScanStream.getVideoTracks()[0]?.getSettings()?.deviceId||"";
  select.innerHTML="";devices.forEach((device,i)=>{const option=document.createElement("option");option.value=device.deviceId;option.textContent=device.label||`Camera ${i+1}`;select.appendChild(option)});if(previous)select.value=previous;
  document.getElementById("qrScannerStop").disabled=false;
  if("BarcodeDetector" in window){try{qrScanDetector=new BarcodeDetector({formats:["qr_code"]})}catch{qrScanDetector=null}}
  if(!qrScanDetector){const fallback=await loadJsQr();if(!fallback){await stopQrCamera();setQrScanStatus("QR scanning is not supported here. Try an updated Chrome browser or enter the Record ID manually.");return}}
  setQrScanStatus("Camera ready. Hold the QR code inside the frame.");scanQrFrame();
 }catch(error){await stopQrCamera();let message="Could not start the camera. Check camera permission and try again.";if(error.name==="NotAllowedError"||error.name==="PermissionDeniedError")message="Camera permission was denied. Allow camera access in your browser settings.";else if(error.name==="NotFoundError"||error.name==="DevicesNotFoundError")message="No camera was found on this device.";else if(error.name==="NotReadableError")message="The camera is busy in another app. Close other camera apps and try again.";else if(!window.isSecureContext)message="Camera access requires a secure HTTPS page. Open the system through its HTTPS address.";setQrScanStatus(message)}
}
async function scanQrFrame(){
 if(!qrScanStream||qrScanVideo.readyState<2){qrScanFrame=requestAnimationFrame(scanQrFrame);return}
 if(qrScanBusy){qrScanFrame=requestAnimationFrame(scanQrFrame);return}
 qrScanBusy=true;
 try{
  let raw="";
  if(qrScanDetector){const codes=await qrScanDetector.detect(qrScanVideo);if(codes.length)raw=codes[0].rawValue||""}
  else if(typeof jsQR==="function"){
   const canvas=scanQrFrame.canvas||(scanQrFrame.canvas=document.createElement("canvas")),ctx=canvas.getContext("2d",{willReadFrequently:true});canvas.width=qrScanVideo.videoWidth;canvas.height=qrScanVideo.videoHeight;ctx.drawImage(qrScanVideo,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);const result=jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:"attemptBoth"});if(result)raw=result.data;
  }
  if(raw){await stopQrCamera();qrScanModal.hidden=true;const input=document.getElementById("qrRecordIdInput");input.value=raw;openRecordFromQrInput();return}
 }catch(error){}
 finally{qrScanBusy=false}
 if(qrScanStream)qrScanFrame=requestAnimationFrame(scanQrFrame);
}
function openQrScanner(){qrScanModal.hidden=false;setQrScanStatus("Requesting camera access…");startQrCamera()}
function closeQrScanner(){stopQrCamera();qrScanModal.hidden=true}
document.getElementById("qrCameraScanOpen").addEventListener("click",openQrScanner);
document.getElementById("qrScannerClose").addEventListener("click",closeQrScanner);
document.getElementById("qrScannerCloseBottom").addEventListener("click",closeQrScanner);
document.getElementById("qrScannerStop").addEventListener("click",stopQrCamera);
document.getElementById("qrScannerCameraSelect").addEventListener("change",e=>startQrCamera(e.target.value));
qrScanModal.addEventListener("click",e=>{if(e.target===qrScanModal)closeQrScanner()});
document.addEventListener("visibilitychange",()=>{if(document.hidden&& !qrScanModal.hidden)stopQrCamera()});





async function renderUsers(){
 const body=document.getElementById("usersTableBody"),count=document.getElementById("usersCount"),msg=document.getElementById("usersMessage");
 if(!canManageUsers()){body.innerHTML='<tr><td colspan="5">Administrator access required.</td></tr>';return}
 body.innerHTML='<tr><td colspan="5">Loading authorized accounts…</td></tr>';msg.textContent="";
 try{
  const {data,error}=await supabaseClient.from("user_profiles").select("user_id,display_name,role,is_active,created_at").order("display_name");
  if(error)throw error;
  count.textContent=`${data.length} authorized account${data.length===1?"":"s"}`;
  body.innerHTML=data.length?data.map(u=>{const self=u.user_id===currentAuthUser?.id;return `<tr><td>${esc(u.display_name||"—")}${self?' <strong>(you)</strong>':''}</td><td><code>${esc(u.user_id)}</code></td><td><select class="user-role-select" data-user-role="${esc(u.user_id)}" ${self?'disabled':''}><option value="administrator" ${u.role==="administrator"?"selected":""}>Administrator</option><option value="registrar" ${u.role==="registrar"?"selected":""}>Registrar</option><option value="enrollment_staff" ${u.role==="enrollment_staff"?"selected":""}>Enrollment Staff</option><option value="read_only" ${u.role==="read_only"?"selected":""}>Read-only</option></select></td><td>${u.is_active?"Active":"Inactive"}</td><td><button class="btn" data-user-save="${esc(u.user_id)}" ${self?'disabled':''}>Save</button> <button class="btn" data-user-toggle="${esc(u.user_id)}" data-active="${u.is_active}" ${self?'disabled':''}>${u.is_active?"Deactivate":"Activate"}</button></td></tr>`}).join(""):'<tr><td colspan="5">No authorized accounts found.</td></tr>';
  body.querySelectorAll("[data-user-save]").forEach(b=>b.addEventListener("click",async()=>{const id=b.dataset.userSave,role=body.querySelector(`[data-user-role="${id}"]`)?.value;if(!canManageUsers())return; b.disabled=true;try{const {error}=await supabaseClient.from("user_profiles").update({role,updated_at:new Date().toISOString()}).eq("user_id",id);if(error)throw error;msg.textContent="Role updated.";await renderUsers()}catch(e){msg.textContent=`Could not update role: ${e.message}`}finally{b.disabled=false}}));
  body.querySelectorAll("[data-user-toggle]").forEach(b=>b.addEventListener("click",async()=>{const id=b.dataset.userToggle,active=b.dataset.active!=="true";if(!canManageUsers()||id===currentAuthUser?.id)return;if(!confirm(`${active?"Activate":"Deactivate"} this account?`))return;b.disabled=true;try{const {error}=await supabaseClient.from("user_profiles").update({is_active:active,updated_at:new Date().toISOString()}).eq("user_id",id);if(error)throw error;msg.textContent=`Account ${active?"activated":"deactivated"}.`;await renderUsers()}catch(e){msg.textContent=`Could not change account status: ${e.message}`}finally{b.disabled=false}}));
 }catch(e){count.textContent="Unable to load accounts";body.innerHTML=`<tr><td colspan="5">${esc(e.message)}</td></tr>`;msg.textContent="Check that the existing administrator profile-management RLS policy permits administrators to read and update profiles."}
}
document.getElementById("refreshUsers")?.addEventListener("click",renderUsers);


function renderLogs(){
 const q=(document.getElementById("logsSearch").value||"").trim().toLowerCase(),a=document.getElementById("logsActionFilter").value;
 const rows=getLogs().slice().sort((x,y)=>new Date(y.timestamp||0)-new Date(x.timestamp||0)).filter(x=>{
  const hay=[x.action,x.recordId,x.user,x.timestamp].join(" ").toLowerCase();
  return(!q||hay.includes(q))&&(!a||x.action===a)
 });
 document.getElementById("logsCount").textContent=`${rows.length} activit${rows.length===1?"y":"ies"}`;
 document.getElementById("logsEmpty").style.display=rows.length?"none":"block";
 document.getElementById("logsTableBody").innerHTML=rows.map(x=>`<tr><td>${esc(formatTime(x.timestamp))}</td><td>${esc(x.user||"—")}</td><td><span class="activity-badge ${actionClass(x.action)}">${esc(x.action||"Activity")}</span></td><td>${esc(x.recordId||"—")}</td><td>${esc(x.details||"—")}</td></tr>`).join("");
}
document.getElementById("logsSearch").addEventListener("input",renderLogs);
document.getElementById("logsActionFilter").addEventListener("change",renderLogs);
document.getElementById("refreshLogs").addEventListener("click",renderLogs);
function syncBackupTabAccess(){const allowed=canManageUsers();for(const id of ["settingsBackupTab","settingsUsersTab"]){const tab=document.getElementById(id);if(!tab)continue;tab.hidden=!allowed;tab.style.display=allowed?"":"none";tab.setAttribute("aria-hidden",String(!allowed));}}
function renderSettings(){loadIdConfigIntoForm();const a=getAccount();const d=document.getElementById("accountDisplayName");const u=document.getElementById("accountUsername");if(d&&document.activeElement!==d)d.value=a.displayName||"";if(u&&document.activeElement!==u)u.value=a.username||"";syncBackupTabAccess();if(!canManageUsers())showSettingsPanel("general")}
function showSettingsPanel(which){const allowed=canManageUsers();const active=which==="backup"&&allowed?"backup":which==="users"&&allowed?"users":"general";const panels={general:document.getElementById("settingsGeneralPanel"),backup:document.getElementById("settingsBackupPanel"),users:document.getElementById("users")};const tabs={general:document.getElementById("settingsGeneralTab"),backup:document.getElementById("settingsBackupTab"),users:document.getElementById("settingsUsersTab")};for(const key of Object.keys(panels)){if(panels[key])panels[key].hidden=key!==active;if(tabs[key]){tabs[key].classList.toggle("active",key===active);tabs[key].setAttribute("aria-selected",String(key===active))}}if(active==="backup")renderBackupCenter();if(active==="users")renderUsers()}
document.getElementById("settingsGeneralTab")?.addEventListener("click",()=>showSettingsPanel("general"));
document.getElementById("settingsBackupTab")?.addEventListener("click",()=>{if(!canManageUsers()){showToast("Backup & Recovery is available to administrators only.");return}showSettingsPanel("backup")});
document.getElementById("settingsUsersTab")?.addEventListener("click",()=>{if(!canManageUsers()){showToast("User Management is available to administrators only.");return}showSettingsPanel("users")});
document.getElementById("saveAccountSettings").addEventListener("click",()=>{showToast("Account details cannot be changed from this page.")});
document.getElementById("clearPrototypeData").addEventListener("click",()=>{alert("Enrollment records and activity logs are saved in the school database. Use Enrollment Records or Trash to manage individual records.")});

let activationPromise=null,activationUserId=null;async function activateSession(user){if(!user?.id)throw new Error("No authenticated account was supplied for session activation.");if(activationPromise&&activationUserId===user.id)return activationPromise;if(activationPromise&&activationUserId!==user.id)await activationPromise;activationUserId=user.id;activationPromise=(async()=>{currentAuthUser=user;let stage="session verification";try{const {data:sessionData,error:sessionError}=await supabaseClient.auth.getSession();if(sessionError)throw sessionError;if(!sessionData?.session?.access_token||sessionData.session.user?.id!==user.id)throw new Error("The sign-in succeeded, but its authenticated session was not available to the database client. Please sign in again.");stage="staff profile lookup";await loadCurrentProfile();stage="enrollment data loading";await loadRemoteData();stage="shared learner ID settings synchronization";await syncSharedIdSettingsOnLogin();const {data:latestSession}=await supabaseClient.auth.getSession();if(latestSession?.session?.user?.id!==user.id)throw new Error("The signed-in account changed during startup. Please sign in again.");stage="dashboard activation";setLoggedIn(user.email)}catch(err){console.error(`Session activation failed during ${stage}`,err);try{const {data:latestSession}=await supabaseClient.auth.getSession();if(latestSession?.session?.user?.id===user.id)await supabaseClient.auth.signOut()}catch(signOutError){console.error("Sign-out after failed startup also failed",signOutError)}if(currentAuthUser?.id===user.id)setLoggedOut();loginError.textContent=describeLoginError(err,stage);loginError.style.display="block"}})();try{return await activationPromise}finally{activationPromise=null;activationUserId=null}}
appShell.style.display="none";loginScreen.style.display="grid";supabaseClient.auth.getSession().then(async({data,error})=>{if(error){console.error("Initial session check failed",error);setLoggedOut();return}if(data.session?.user)await activateSession(data.session.user);else setLoggedOut()});supabaseClient.auth.onAuthStateChange((event,session)=>{if(event==="INITIAL_SESSION")return;if(event==="SIGNED_OUT"||!session?.user){setLoggedOut();return}if(activationPromise&&activationUserId===session.user.id)return;if(currentAuthUser?.id===session.user.id&&currentProfile)return;if(currentAuthUser?.id&&currentAuthUser.id!==session.user.id){clearSensitivePhotoState();recordsCache=[];logsCache=[];currentProfile=null;}setTimeout(async()=>{const {data,error}=await supabaseClient.auth.getSession();if(error){console.error("Auth event session verification failed",error);return}if(data.session?.user?.id===session.user.id)await activateSession(data.session.user)},0)});showStep(1);



const BACKUP_FORMAT="TNHS_CES_BACKUP",BACKUP_VERSION=2,LEGACY_BACKUP_VERSION=1,BACKUP_MAX_BYTES=50*1024*1024;
let pendingBackupImport=null;
async function fetchAllRows(table,columns="*"){
 const all=[];const pageSize=1000;let from=0;
 while(true){const {data,error}=await supabaseClient.from(table).select(columns).range(from,from+pageSize-1);if(error)throw error;if(data?.length)all.push(...data);if(!data||data.length<pageSize)break;from+=pageSize;}
 return all;
}
function downloadJsonFile(payload,filename){const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function backupStatus(message,isError=false){const el=document.getElementById("backupStatus");if(el){el.textContent=message;el.style.color=isError?"#b42318":"#175c3a"}}
function bytesToBase64(buffer){const bytes=new Uint8Array(buffer);let binary="";const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));return btoa(binary)}
function base64ToBytes(value){const binary=atob(value);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
async function sha256Hex(value){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function backupCanonicalContents(contents){return JSON.stringify(contents)}
function renderBackupCenter(){if(!canManageUsers())return;const preview=document.getElementById("backupPreview");if(preview&&!pendingBackupImport)preview.textContent="No backup file selected."}
async function collectBackupPhotos(records){
 const paths=[...new Set(records.map(r=>r.student_photo_path).filter(p=>typeof p==="string"&&p.trim()))];const photos=[];let total=0;
 for(let i=0;i<paths.length;i++){
  backupStatus(`Collecting student photos… ${i+1} of ${paths.length}`);
  const path=paths[i];const {data,error}=await supabaseClient.storage.from("student-photos").download(path);
  if(error)throw new Error(`Could not include student photo ${path}: ${error.message||error}`);
  const buffer=await data.arrayBuffer();total+=buffer.byteLength;
  if(total>BACKUP_MAX_BYTES)throw new Error("Student photos exceed the 50 MB in-app backup limit. No backup file was downloaded; use a separate storage export for this dataset.");
  photos.push({path,content_type:data.type||"application/octet-stream",size:buffer.byteLength,base64:bytesToBase64(buffer)});
 }
 return photos;
}
async function createSystemBackup(){if(!canManageUsers())throw new Error("Administrator access is required.");const btn=document.getElementById("createBackupBtn");btn.disabled=true;backupStatus("Collecting database records…");try{
 const [records,logs,history]=await Promise.all([fetchAllRows("enrollment_records"),fetchAllRows("activity_logs"),fetchAllRows("enrollment_change_history","record_id,actor_display_name,change_type,changed_fields,changed_at")]);
 const photos=await collectBackupPhotos(records);const contents={enrollment_records:records,activity_logs:logs,enrollment_change_history:history,student_photos:photos};
 const payload={format:BACKUP_FORMAT,version:BACKUP_VERSION,school:"Talugtug National High School",created_at:new Date().toISOString(),created_by:{user_id:currentAuthUser?.id||null,display_name:currentUser()},manifest:{record_count:records.length,activity_log_count:logs.length,change_history_count:history.length,photo_count:photos.length,photo_bytes:photos.reduce((n,p)=>n+p.size,0)},contents,integrity:{algorithm:"SHA-256",contents_sha256:await sha256Hex(backupCanonicalContents(contents))},notes:{storage_photos:"Referenced student photo files from the student-photos bucket are embedded in this backup.",auth:"Authentication users, passwords, sessions, and user_profiles are not included.",restore:"Recovery adds missing enrollment Record IDs only. Existing rows are never overwritten. Activity and change history remain archive-only. Student photos are restored only when the storage path is not already present."}};
 const json=JSON.stringify(payload);if(new Blob([json]).size>BACKUP_MAX_BYTES)throw new Error("The completed backup exceeds the 50 MB in-app limit. No backup file was downloaded.");const stamp=new Date().toISOString().replace(/[:.]/g,"-");downloadJsonFile(payload,`TNHS_CES_Backup_${stamp}.json`);backupStatus(`Backup downloaded and verified. ${records.length} enrollment records, ${logs.length} activity logs, ${history.length} change-history rows, and ${photos.length} student photos included.`);
 }catch(e){console.error("Backup creation failed",e);backupStatus(`Backup failed: ${e.message||e}`,true)}finally{btn.disabled=false}}
function validateBackupPayload(data){if(!data||data.format!==BACKUP_FORMAT||![LEGACY_BACKUP_VERSION,BACKUP_VERSION].includes(data.version))throw new Error("This is not a supported TNHS CES backup file.");const rows=data.contents?.enrollment_records;if(!Array.isArray(rows))throw new Error("Backup is missing enrollment_records.");if(rows.length>50000)throw new Error("Backup contains too many records for this in-app recovery tool.");const seen=new Set();for(const row of rows){if(!row||typeof row.record_id!=="string"||!row.record_id.trim())throw new Error("A record is missing its Record ID.");if(seen.has(row.record_id))throw new Error(`Duplicate Record ID in backup: ${row.record_id}`);seen.add(row.record_id);if(!row.school_year||!row.grade_level)throw new Error(`Record ${row.record_id} is missing required enrollment fields.`)}
 if(data.version===BACKUP_VERSION){if(!Array.isArray(data.contents.student_photos))throw new Error("Version 2 backup is missing its student photo list.");const m=data.manifest;if(!m||m.record_count!==rows.length||m.activity_log_count!==(Array.isArray(data.contents.activity_logs)?data.contents.activity_logs.length:0)||m.change_history_count!==(Array.isArray(data.contents.enrollment_change_history)?data.contents.enrollment_change_history.length:0)||m.photo_count!==data.contents.student_photos.length)throw new Error("Backup manifest counts do not match the contents.");const photoPaths=new Set();for(const photo of data.contents.student_photos){if(!photo||typeof photo.path!=="string"||!photo.path.trim()||typeof photo.base64!=="string"||!Number.isFinite(photo.size)||photo.size<0)throw new Error("A student photo entry is incomplete.");if(photoPaths.has(photo.path))throw new Error(`Duplicate student photo path: ${photo.path}`);photoPaths.add(photo.path);if(!rows.some(r=>r.student_photo_path===photo.path))throw new Error(`Photo path is not referenced by an enrollment record: ${photo.path}`);const bytes=base64ToBytes(photo.base64);if(bytes.byteLength!==photo.size)throw new Error(`Student photo size mismatch: ${photo.path}`)}}return rows}
async function verifyBackupIntegrity(data){if(data.version===LEGACY_BACKUP_VERSION)return; if(data.integrity?.algorithm!=="SHA-256"||typeof data.integrity.contents_sha256!=="string")throw new Error("Backup integrity information is missing.");const actual=await sha256Hex(backupCanonicalContents(data.contents));if(actual!==data.integrity.contents_sha256)throw new Error("Backup integrity check failed. The file may be incomplete or modified.")}
async function inspectBackupFile(file){pendingBackupImport=null;const preview=document.getElementById("backupPreview"),restore=document.getElementById("restoreBackupBtn");restore.disabled=true;if(!file){preview.textContent="No backup file selected.";return}try{if(file.size>BACKUP_MAX_BYTES)throw new Error("Backup file exceeds the 50 MB in-app limit.");const data=JSON.parse(await file.text());const rows=validateBackupPayload(data);await verifyBackupIntegrity(data);pendingBackupImport=data;const photoCount=data.version===BACKUP_VERSION?data.contents.student_photos.length:0;preview.textContent=`Valid TNHS backup v${data.version} · Created ${data.created_at?new Date(data.created_at).toLocaleString():"date unavailable"} · ${rows.length} enrollment records · ${photoCount} student photos · ${Array.isArray(data.contents.activity_logs)?data.contents.activity_logs.length:0} activity log rows. Recovery adds missing Record IDs only; existing records are never overwritten.`;restore.disabled=rows.length===0;backupStatus("Backup structure and integrity validated. Review the recovery summary before proceeding.")}catch(e){pendingBackupImport=null;preview.textContent=`Cannot use this backup: ${e.message||e}`;backupStatus("Backup validation failed.",true)}}
async function restoreMissingRecords(){if(!canManageUsers()||!pendingBackupImport)throw new Error("Select and validate a backup file first.");const data=pendingBackupImport,rows=validateBackupPayload(data);await verifyBackupIntegrity(data);const btn=document.getElementById("restoreBackupBtn");btn.disabled=true;try{
 backupStatus("Preflighting records and photo conflicts…");const existing=await fetchAllRows("enrollment_records","record_id");const ids=new Set(existing.map(x=>x.record_id));const missing=rows.filter(r=>!ids.has(r.record_id));const existingPhotoPaths=new Set();const photos=data.version===BACKUP_VERSION?data.contents.student_photos:[];
 for(let i=0;i<photos.length;i++){const photo=photos[i];const {data:found,error}=await supabaseClient.storage.from("student-photos").download(photo.path);if(!error&&found)existingPhotoPaths.add(photo.path);else if(error&&!/not found|object not found|404/i.test(error.message||""))throw new Error(`Photo preflight failed for ${photo.path}: ${error.message||error}`)}
 const missingPhotoPaths=new Set(missing.map(r=>r.student_photo_path).filter(Boolean));const photosToUpload=photos.filter(p=>missingPhotoPaths.has(p.path)&&!existingPhotoPaths.has(p.path));
 const summary=`Recovery preflight complete.\n\n${rows.length} records in backup\n${missing.length} missing records to insert\n${rows.length-missing.length} existing records to skip\n${photosToUpload.length} photos to upload\n${existingPhotoPaths.size} existing photo paths to preserve\n\nExisting records and existing photo files will not be overwritten. Continue?`;
 if(!missing.length&&!photosToUpload.length){backupStatus("Recovery complete: no missing records or photos found. Nothing was changed.");return}if(!confirm(summary))return;
 let inserted=0,uploaded=0;for(let i=0;i<missing.length;i+=50){const chunk=missing.slice(i,i+50);const {data:insertedRows,error}=await supabaseClient.from("enrollment_records").insert(chunk).select("record_id");if(error)throw new Error(`Inserted ${inserted} record(s) before the operation stopped: ${error.message}`);inserted+=insertedRows?.length||chunk.length;backupStatus(`Recovering records… ${inserted} of ${missing.length}`)}
 for(const photo of photosToUpload){const bytes=base64ToBytes(photo.base64);const blob=new Blob([bytes],{type:photo.content_type||"application/octet-stream"});const {error}=await supabaseClient.storage.from("student-photos").upload(photo.path,blob,{upsert:false,contentType:photo.content_type||"application/octet-stream",cacheControl:"3600"});if(error)throw new Error(`Recovered ${inserted} record(s) and ${uploaded} photo(s) before photo recovery stopped at ${photo.path}: ${error.message}`);uploaded++;backupStatus(`Restoring student photos… ${uploaded} of ${photosToUpload.length}`)}
 await loadRemoteData();backupStatus(`Recovery finished. ${inserted} missing record(s) added, ${rows.length-inserted} existing record(s) skipped, ${uploaded} photo(s) uploaded, and ${existingPhotoPaths.size} existing photo path(s) preserved. Audit history remains archive-only.`);pendingBackupImport=null;document.getElementById("backupImportFile").value="";document.getElementById("backupPreview").textContent="No backup file selected.";btn.disabled=true;
 }catch(e){console.error("Recovery failed",e);backupStatus(`Recovery stopped: ${e.message||e}. Some earlier records or photos may already have been recovered; review the database and Storage before retrying.`,true)}finally{btn.disabled=!pendingBackupImport}}
document.getElementById("createBackupBtn")?.addEventListener("click",createSystemBackup);
document.getElementById("backupImportFile")?.addEventListener("change",e=>inspectBackupFile(e.target.files?.[0]));
document.getElementById("restoreBackupBtn")?.addEventListener("click",restoreMissingRecords);



const LEGACY_ID_ADVISER_KEY="tnhsLearnerIdAdvisersV1",LEGACY_ID_GUARDIAN_ADDRESS_KEY="tnhsLearnerIdGuardianAddressesV1";

try{localStorage.removeItem(LEGACY_ID_ADVISER_KEY);localStorage.removeItem(LEGACY_ID_GUARDIAN_ADDRESS_KEY);localStorage.removeItem("tnhsRememberSetting");}catch{}
let idAdviserAssignments={};
const DEFAULT_ID_CONFIG={schoolName:"TALUGTUG NATIONAL HIGH SCHOOL",schoolAddress:"Cabiangan, Talugtug, Nueva Ecija",schoolNumber:"300866",principalName:"FROILAN M. SILAO",principalPosition:"Secondary School Principal III",defaultAdviser:"",signatureDataUrl:''};
let sharedIdSettingsReady=false,idConfigReady=false,idConfigState={...DEFAULT_ID_CONFIG};
function readIdConfig(){return {...idConfigState};}
function readIdAdvisers(){return idAdviserAssignments;}
async function fetchSharedIdSetting(key){const {data,error}=await supabaseClient.from("learner_id_settings").select("setting_value").eq("setting_key",key).maybeSingle();if(error)throw error;return data?.setting_value??null;}
async function saveSharedIdSetting(key,value){const payload={setting_key:key,setting_value:value,updated_at:new Date().toISOString(),updated_by:currentAuthUser?.id||null};const {error}=await supabaseClient.from("learner_id_settings").upsert(payload,{onConflict:"setting_key"});if(error)throw error;}
async function syncSharedIdSettingsOnLogin(){
 sharedIdSettingsReady=false;idConfigReady=false;idConfigState={...DEFAULT_ID_CONFIG};if(!currentAuthUser)return;
 try{
  const remoteConfig=await fetchSharedIdSetting("configuration");
  if(remoteConfig&&typeof remoteConfig==="object"&&!Array.isArray(remoteConfig)){idConfigState={...DEFAULT_ID_CONFIG,...remoteConfig};}
  idConfigReady=true;
  const status=document.getElementById("idConfigStatus");if(status)status.textContent=remoteConfig?"Shared learner ID configuration loaded from the database.":"No shared configuration exists yet. Default values are shown until an administrator saves them.";
 }catch(error){
  console.error("Unable to load learner ID configuration from the database.",error);
  const status=document.getElementById("idConfigStatus");if(status)status.textContent="Database unavailable. Learner ID configuration could not be loaded; local settings will not be used.";
 }
 try{
  let remoteAdvisers=await fetchSharedIdSetting("adviser_assignments");
  if(remoteAdvisers&&typeof remoteAdvisers==="object"&&!Array.isArray(remoteAdvisers)){idAdviserAssignments=remoteAdvisers;}else{idAdviserAssignments={};}
 }catch(error){console.error("Shared adviser settings synchronization failed.",error);}
 sharedIdSettingsReady=idConfigReady;
 if(typeof loadIdConfigIntoForm==="function")loadIdConfigIntoForm();
 if(typeof loadIdConfigIntoLearnerPreview==="function")loadIdConfigIntoLearnerPreview();
}
async function saveIdConfig(){
 if(!canManageUsers()){showToast("Only administrators can edit learner ID school details.");return}
 if(!idConfigReady){showToast("Learner ID configuration is unavailable. Reconnect to the database and reload before saving.");return}
 const previous=readIdConfig();
 const cfg={schoolName:document.getElementById("idSchoolName").value.trim(),schoolAddress:document.getElementById("idSchoolAddress").value.trim(),schoolNumber:document.getElementById("idSchoolNumber").value.trim(),principalName:document.getElementById("idPrincipalName").value.trim(),principalPosition:document.getElementById("idPrincipalPosition").value.trim(),defaultAdviser:document.getElementById("idDefaultAdviser").value.trim(),signatureDataUrl:window.pendingPrincipalSignatureDataUrl||previous.signatureDataUrl||""};
 const status=document.getElementById("idConfigStatus");
 try{
  await saveSharedIdSetting("configuration",cfg);
  idConfigState={...DEFAULT_ID_CONFIG,...cfg};
  window.pendingPrincipalSignatureDataUrl="";
  const file=document.getElementById("idPrincipalSignatureFile");if(file)file.value="";
  if(status)status.textContent="Saved to the shared database.";
  if(typeof loadIdConfigIntoForm==="function")loadIdConfigIntoForm();
  if(typeof loadIdConfigIntoLearnerPreview==="function")loadIdConfigIntoLearnerPreview();
  showToast("Learner ID settings saved to the shared database.");
 }catch(error){
  console.error("Unable to save shared learner ID settings",error);
  if(status)status.textContent="Database save failed. No local copy was saved; the last successfully loaded configuration remains in use.";
  showToast("Unable to save learner ID settings to the database. Please check your connection and try again.");
 }
}
function loadIdConfigIntoForm(){
 const c=readIdConfig(),ready=idConfigReady;
 for(const [id,key] of [["idSchoolName","schoolName"],["idSchoolAddress","schoolAddress"],["idSchoolNumber","schoolNumber"],["idPrincipalName","principalName"],["idPrincipalPosition","principalPosition"],["idDefaultAdviser","defaultAdviser"]]){
  const el=document.getElementById(id);if(el){el.value=ready?(c[key]||""):"";el.disabled=!ready;}
 }
 const file=document.getElementById("idPrincipalSignatureFile");if(file)file.disabled=!ready;
 const preview=document.getElementById("idPrincipalSignaturePreview");if(preview)preview.src=ready?(c.signatureDataUrl||'assets/principal_signature.png'):'';
 const btn=document.getElementById("saveIdConfig");if(btn){btn.hidden=!canManageUsers();btn.disabled=!ready;}
}
function adviserKey(r){return [r.schoolYear||"",r.gradeLevel||"",r.sectionName||""].join("|")}
function getIdAdviser(r){const map=readIdAdvisers();return map[adviserKey(r)]||readIdConfig().defaultAdviser||""}
function renderLearnerIdPage(){
 const select=document.getElementById("learnerIdSelect");if(!select)return;
 const old=String(select.value||"");
 const rows=getActiveRecords().slice().sort((a,b)=>fullName(a).localeCompare(fullName(b)));
 select.innerHTML='<option value="">Choose a learner</option>'+rows.map(r=>`<option value="${esc(String(r.recordId||""))}">${esc(fullName(r)||"Unnamed learner")} · ${esc(r.recordId||"")} · Grade ${esc(r.gradeLevel||"—")}</option>`).join("");
 if(old&&rows.some(r=>String(r.recordId)===old))select.value=old;
 else if(rows.length===1)select.value=String(rows[0].recordId||"");
 loadIdConfigIntoLearnerPreview();
 renderLearnerIdPreview();
}
function loadIdConfigIntoLearnerPreview(){
 const c=readIdConfig(),ready=idConfigReady;
 const values={idPreviewSchoolName:ready?c.schoolName:"",idPreviewSchoolAddress:ready?c.schoolAddress:"",idPreviewSchoolNumber:ready?c.schoolNumber:"",idPreviewPrincipalName:ready?c.principalName:"",idPreviewPrincipalPosition:ready?c.principalPosition:"",idPreviewBackSchoolName:ready?c.schoolName:"",idPreviewBackSchoolAddress:ready?String(c.schoolAddress||"").toUpperCase():""};
 const signature=document.querySelector(".tnhs-id-signature-image");if(signature)signature.src=ready?(c.signatureDataUrl||"assets/principal_signature.png"):"";
 for(const [id,value] of Object.entries(values)){const el=document.getElementById(id);if(el)el.textContent=value||""}
}
function idParentAddress(r){
 const a=r.currentAddress||{},p=r.permanentAddress||{};
 const current=[a.house,a.street,a.barangay,a.municipality,a.province,a.zip].filter(x=>String(x||"").trim()).join(", ");
 if(current)return current;
 return [p.house,p.street,p.barangay,p.municipality,p.province,p.zip].filter(x=>String(x||"").trim()).join(", ");
}
function idEmergencyContact(r){
 const g=r.guardian||{},m=r.mother||{},f=r.father||{};
 const hasName=x=>[x.first,x.middle,x.last].some(v=>String(v||"").trim());
 let person=hasName(g)?g:(hasName(m)&&!m.notProvided?m:(hasName(f)&&!f.notProvided?f:(hasName(m)?m:f)));
 const name=[person.first,person.middle,person.last].filter(x=>String(x||"").trim()).join(" ");
 const contact=g.contact||person.contact||m.contact||f.contact||"";
 return {name,contact,address:idParentAddress(r)};
}
async function renderLearnerIdPreview(){
 const select=document.getElementById("learnerIdSelect"),id=String(select?.value||"");
 const rows=getActiveRecords(),r=rows.find(x=>String(x.recordId||"").trim()===id.trim());
 const preview=document.getElementById("learnerIdPreview"),print=document.getElementById("printLearnerId"),save=document.getElementById("saveLearnerIdDetails");
 if(!preview||!print)return;
 const set=(elementId,value)=>{const el=document.getElementById(elementId);if(el)el.textContent=value||""};
 if(!idConfigReady){loadIdConfigIntoLearnerPreview();set("idPreviewLrn","");set("idPreviewName","");set("idPreviewBirthdate","");set("idPreviewGuardianName","");set("idPreviewGuardianAddress","");set("idPreviewGuardianContact","");set("idPreviewReminderYear","");set("idPreviewYear","");set("idPreviewGradeSection","");set("idPreviewAdviser","");const photo=document.getElementById("idPreviewPhoto");if(photo)photo.innerHTML="";const adviser=document.getElementById("learnerIdAdviser");if(adviser)adviser.value="";print.disabled=true;if(save)save.disabled=true;return;}
 loadIdConfigIntoLearnerPreview();
 if(!r){
  set("idPreviewLrn","000000000000");set("idPreviewName","LEARNER FULL NAME");set("idPreviewBirthdate","MONTH DD, YYYY");
  set("idPreviewGuardianName","GUARDIAN NAME");set("idPreviewGuardianAddress","GUARDIAN ADDRESS");set("idPreviewGuardianContact","CONTACT NUMBER");
  set("idPreviewReminderYear","YYYY–YYYY");set("idPreviewYear","YYYY–YYYY");set("idPreviewGradeSection","GRADE & SECTION");set("idPreviewAdviser","CLASS ADVISER");
  const photo=document.getElementById("idPreviewPhoto");if(photo)photo.innerHTML="<span>2 × 2<br>LEARNER PHOTO</span>";
  const adviser=document.getElementById("learnerIdAdviser");if(adviser)adviser.value="";
  print.disabled=true;if(save)save.disabled=true;return;
 }
 const photoUrl=r.photoPath?await getStudentPhotoUrl(r.photoPath).catch(err=>{console.warn("Learner ID photo unavailable",err);return ""}):"";
 if(String(select?.value||"")!==id)return;
 const emergency=idEmergencyContact(r),adviser=getIdAdviser(r),year=r.schoolYear||"";
 set("idPreviewLrn",r.lrn||"LRN NOT PROVIDED");set("idPreviewName",fullName(r)||"NAME NOT PROVIDED");set("idPreviewBirthdate",r.birthdate?formatDate(r.birthdate):"BIRTHDATE NOT PROVIDED");
 set("idPreviewGuardianName",emergency.name||"NOT PROVIDED");set("idPreviewGuardianAddress",emergency.address||"ADDRESS NOT PROVIDED");set("idPreviewGuardianContact",emergency.contact||"CONTACT NOT PROVIDED");
 set("idPreviewReminderYear",year||"SCHOOL YEAR NOT PROVIDED");set("idPreviewYear",year||"—");
 set("idPreviewGradeSection",r.gradeLevel?`${r.gradeLevel} - ${r.sectionName||""}`.trim():(r.sectionName||"—"));set("idPreviewAdviser",adviser||"NOT ASSIGNED");
 const photo=document.getElementById("idPreviewPhoto");if(photo){photo.innerHTML="";if(photoUrl){const img=document.createElement("img");img.src=photoUrl;img.alt="Learner photo";photo.appendChild(img)}else{const span=document.createElement("span");span.innerHTML="2 × 2<br>PHOTO NOT AVAILABLE";photo.appendChild(span)}}
 const cardQr=document.getElementById("idPreviewCardQr");
 if(cardQr){
  cardQr.replaceChildren();
  const qrReady=await loadQrLibrary();
  if(String(select?.value||"")!==id)return;
  if(qrReady){
   const renderTarget=document.createElement("div");
   renderTarget.setAttribute("aria-hidden","true");
   renderTarget.style.cssText="position:absolute;left:-10000px;top:0;width:180px;height:180px;overflow:hidden";
   document.body.appendChild(renderTarget);
   try{
    new QRCode(renderTarget,{text:`TNHS-CES|${r.recordId}`,width:360,height:360,colorDark:"#142b4a",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});
    const canvas=renderTarget.querySelector("canvas");
    const generatedImage=renderTarget.querySelector("img");
    const dataUrl=canvas?canvas.toDataURL("image/png"):generatedImage?.src||"";
    if(dataUrl){
     const printSafeImage=document.createElement("img");
     printSafeImage.src=dataUrl;
     printSafeImage.alt="Learner record QR code";
     printSafeImage.width=360;printSafeImage.height=360;
     printSafeImage.decoding="sync";
     printSafeImage.style.cssText="display:block;width:100%;height:100%;object-fit:contain;image-rendering:pixelated";
     cardQr.replaceChildren(printSafeImage);
    }else{cardQr.textContent="QR unavailable";}
   }catch(error){console.error("Unable to render print-safe learner ID QR",error);cardQr.textContent="QR unavailable";}
   finally{renderTarget.remove();}
  }else{cardQr.textContent="QR unavailable";}
 }
 const adviserInput=document.getElementById("learnerIdAdviser");if(adviserInput)adviserInput.value=adviser;
 print.disabled=false;if(save)save.disabled=!canWrite();
}

async function saveLearnerIdDetails(){
 if(!canWrite()){showToast("Your account has view-only access.");return}
 const id=String(document.getElementById("learnerIdSelect").value||""),r=getActiveRecords().find(x=>String(x.recordId||"")===id);if(!r)return;
 const map=readIdAdvisers(),value=document.getElementById("learnerIdAdviser").value.trim();
 if(value)map[adviserKey(r)]=value;else delete map[adviserKey(r)];
 try{await saveSharedIdSetting("adviser_assignments",map);idAdviserAssignments=map;showToast("Class adviser saved to the shared database.");}
 catch(error){console.error("Unable to save shared adviser assignments",error);showToast("Unable to save adviser assignment. Existing saved data was kept.");return;}
 await renderLearnerIdPreview();
}

const learnerIdBatchSelection=new Set();
function getLearnerIdBatchRows(){
 return getActiveRecords().filter(r=>String(r.recordId||"").trim()).slice().sort((a,b)=>fullName(a).localeCompare(fullName(b)));
}
function learnerIdBatchGrade(r){return String(r.gradeLevel||"").trim()}
function learnerIdBatchSection(r){return String(r.sectionName||"").trim()}
function updateLearnerIdBatchSummary(){
 const summary=document.getElementById("learnerIdBatchSummary");if(!summary)return;
 const count=learnerIdBatchSelection.size,sheets=Math.ceil(count/4);
 summary.textContent=`${count} ${count===1?"learner":"learners"} selected · ${sheets} estimated ${sheets===1?"sheet":"sheets"} (4 learners per sheet)`;
}
function renderLearnerIdBatchList(){
 const list=document.getElementById("learnerIdBatchList"),method=document.getElementById("learnerIdBatchMethod")?.value||"manual";
 const grade=document.getElementById("learnerIdBatchGrade")?.value||"",section=document.getElementById("learnerIdBatchSection")?.value||"";
 const rows=getLearnerIdBatchRows();if(!list)return;
 const visible=method==="grade-section"?rows.filter(r=>(!grade||learnerIdBatchGrade(r)===grade)&&(!section||learnerIdBatchSection(r)===section)):rows;
 const count=document.getElementById("learnerIdBatchListCount");if(count)count.textContent=`${visible.length} ${visible.length===1?"learner":"learners"}`;
 if(!visible.length){list.innerHTML='<p class="learner-id-batch-empty">No enrolled learners match this selection.</p>';updateLearnerIdBatchSummary();return;}
 list.innerHTML=visible.map(r=>{const id=String(r.recordId).trim(),checked=learnerIdBatchSelection.has(id)?"checked":"";return `<label class="learner-id-batch-row"><input type="checkbox" data-learner-id-batch-record="${esc(id)}" ${checked}><span class="learner-id-batch-name">${esc(fullName(r)||"Unnamed learner")}</span><span class="learner-id-batch-meta">${esc(id)} · Grade ${esc(learnerIdBatchGrade(r)||"—")} · ${esc(learnerIdBatchSection(r)||"No section")}</span></label>`}).join("");
 updateLearnerIdBatchSummary();
}
function populateLearnerIdBatchFilters(){
 const rows=getLearnerIdBatchRows(),grade=document.getElementById("learnerIdBatchGrade"),section=document.getElementById("learnerIdBatchSection");
 if(!grade||!section)return;
 const previousGrade=grade.value,previousSection=section.value;
 const grades=[...new Set(rows.map(learnerIdBatchGrade).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 grade.innerHTML='<option value="">Choose grade</option>'+grades.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
 if(grades.includes(previousGrade))grade.value=previousGrade;
 const sections=[...new Set(rows.filter(r=>!grade.value||learnerIdBatchGrade(r)===grade.value).map(learnerIdBatchSection).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 section.innerHTML='<option value="">Choose section</option>'+sections.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
 if(sections.includes(previousSection))section.value=previousSection;
}
function updateLearnerIdBatchMethodUI(){
 const method=document.getElementById("learnerIdBatchMethod")?.value||"manual",gradeWrap=document.getElementById("learnerIdBatchGradeWrap"),sectionWrap=document.getElementById("learnerIdBatchSectionWrap"),add=document.getElementById("addLearnerIdBatchGroup"),list=document.getElementById("learnerIdBatchList");
 const isGroup=method==="grade-section";
 if(gradeWrap)gradeWrap.hidden=!isGroup;if(sectionWrap)sectionWrap.hidden=!isGroup;if(add)add.hidden=!isGroup;
 if(method==="all"){
  learnerIdBatchSelection.clear();getLearnerIdBatchRows().forEach(r=>learnerIdBatchSelection.add(String(r.recordId).trim()));
 }
 renderLearnerIdBatchList();
}
function openLearnerIdBatch(){
 const panel=document.getElementById("learnerIdBatchPanel");if(!panel)return;
 populateLearnerIdBatchFilters();panel.hidden=false;updateLearnerIdBatchMethodUI();document.getElementById("learnerIdBatchMethod")?.focus();
}
function closeLearnerIdBatch(){const panel=document.getElementById("learnerIdBatchPanel");if(panel)panel.hidden=true}
function addLearnerIdBatchGradeSection(){
 const grade=document.getElementById("learnerIdBatchGrade")?.value||"",section=document.getElementById("learnerIdBatchSection")?.value||"";
 if(!grade||!section){showToast("Choose both a grade level and section first.");return;}
 getLearnerIdBatchRows().filter(r=>learnerIdBatchGrade(r)===grade&&learnerIdBatchSection(r)===section).forEach(r=>learnerIdBatchSelection.add(String(r.recordId).trim()));
 renderLearnerIdBatchList();
}
function clearLearnerIdBatchSelection(){learnerIdBatchSelection.clear();renderLearnerIdBatchList()}
function finishLearnerIdBatchSelection(){
 updateLearnerIdBatchSummary();
 if(!learnerIdBatchSelection.size){showToast("Select at least one learner for batch printing.");return;}
 generateLearnerIdBatchPrint();
}
async function waitForLearnerIdImages(root){
 const images=Array.from(root.querySelectorAll("img"));
 await Promise.all(images.map(async img=>{
  if(!img.complete)await new Promise(resolve=>{img.addEventListener("load",resolve,{once:true});img.addEventListener("error",resolve,{once:true})});
  if(img.complete&&img.naturalWidth&&typeof img.decode==="function")await img.decode().catch(()=>{});
 }));
}

async function printLearnerIdInIsolatedFrame(output, pageSize, layoutCss, pageRule){
 const frame=document.createElement("iframe");
 frame.setAttribute("title","Learner ID print preview");
 frame.setAttribute("aria-hidden","true");
 frame.style.cssText="position:fixed;left:-1400px;top:0;width:1280px;height:900px;border:0;visibility:hidden;pointer-events:none";
 document.body.appendChild(frame);
 const doc=frame.contentDocument;
 doc.open();
 doc.write(`<!doctype html><html><head><meta charset="utf-8"><base href="${document.baseURI.replace(/&/g,"&amp;").replace(/\"/g,"&quot;")}"><title>Learner ID Print</title></head><body></body></html>`);
 doc.close();
 document.querySelectorAll('link[rel="stylesheet"]').forEach(source=>{
  const link=doc.createElement("link");
  link.rel="stylesheet";link.href=source.href;
  if(source.media)link.media=source.media;
  doc.head.appendChild(link);
 });
 document.querySelectorAll("style").forEach(source=>{
  const style=doc.createElement("style");
  style.textContent=source.textContent||"";
  if(source.media)style.media=source.media;
  doc.head.appendChild(style);
 });
 const isolatedOutput=doc.importNode(output,true);
 doc.body.appendChild(isolatedOutput);
 const override=doc.createElement("style");
 const pageWidth=pageSize.includes("A4 landscape")?"297mm":pageSize.includes("A4 portrait")?"210mm":pageSize.split(" ")[0];
 const pageHeight=pageSize.includes("A4 landscape")?"210mm":pageSize.includes("A4 portrait")?"297mm":(pageSize.split(" ")[1]||"85.6mm");
 override.textContent=`${pageRule||`@page{size:${pageSize};margin:0}`}
 @media print{html,body{width:${pageWidth}!important;height:${pageHeight}!important;margin:0!important;padding:0!important;background:#fff!important}body{overflow:visible!important}#${output.id}{display:block!important;position:static!important;visibility:visible!important;margin:0!important;padding:0!important;background:#fff!important}#${output.id},#${output.id} *{visibility:visible!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}${layoutCss}}
 @media screen{html,body{margin:0!important;padding:0!important;background:#fff!important}#${output.id}{display:block!important}}`;
 doc.head.appendChild(override);
 try{
  await Promise.all(Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(link=>link.sheet?Promise.resolve():new Promise(resolve=>{link.addEventListener("load",resolve,{once:true});link.addEventListener("error",resolve,{once:true});setTimeout(resolve,8000)})));
  await waitForLearnerIdImages(doc);
  if(doc.fonts?.ready)await doc.fonts.ready;
  const cleanup=()=>{if(frame.isConnected)frame.remove()};
  frame.contentWindow.addEventListener("afterprint",cleanup,{once:true});
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(cleanup,60000);
 }catch(error){frame.remove();throw error}
}

async function generateLearnerIdBatchPrint(){
 const button=document.getElementById("finishLearnerIdBatchSelection");
 const select=document.getElementById("learnerIdSelect"),preview=document.getElementById("learnerIdPreview"),adviserInput=document.getElementById("learnerIdAdviser");
 const ids=Array.from(learnerIdBatchSelection);
 const records=getLearnerIdBatchRows().filter(r=>ids.includes(String(r.recordId||"").trim()));
 if(!records.length){showToast("No eligible enrolled learners are selected.");return;}
 if(!idConfigReady){showToast("Complete the Learner ID school configuration before batch printing.");return;}
 if(!select||!preview||!preview.querySelector(".tnhs-id-card"))return;
 const originalId=String(select.value||""),originalAdviser=adviserInput?.value||"",originalPreview=preview.innerHTML;
 const cardsByLearner=[];
 if(button){button.disabled=true;button.textContent="Preparing IDs…";}
 try{
  for(const record of records){
   select.value=String(record.recordId||"");
   await renderLearnerIdPreview();
   const cards=Array.from(preview.querySelectorAll(":scope > .tnhs-id-card"));
   if(cards.length!==2)throw new Error(`Unable to prepare both ID sides for ${fullName(record)||record.recordId}.`);
   await waitForLearnerIdImages(preview);
   cardsByLearner.push({name:fullName(record)||"Unnamed learner",front:cards[0].cloneNode(true),back:cards[1].cloneNode(true)});
  }
 }catch(error){
  console.error("Batch learner ID preparation failed",error);
  showToast(error.message||"Unable to prepare the selected learner IDs.");
  return;
 }finally{
  preview.innerHTML=originalPreview;
  select.value=originalId;
  if(adviserInput)adviserInput.value=originalAdviser;
  if(button){button.disabled=false;button.textContent="Generate Batch Print Preview";}
 }
 const output=document.createElement("div");output.id="learnerIdBatchPrintOutput";output.setAttribute("aria-hidden","true");
 const sourceCard=preview.querySelector(":scope > .tnhs-id-card");
 const measuredWidth=sourceCard?.getBoundingClientRect().width||400;
 const measuredHeight=sourceCard?.getBoundingClientRect().height||measuredWidth/0.645;
 const sourceWidthMm=measuredWidth*25.4/96,sourceHeightMm=measuredHeight*25.4/96;
 const scaleX=54/sourceWidthMm,scaleY=85.6/sourceHeightMm;
 const prepareCard=(card)=>{
  card.removeAttribute("hidden");
  card.style.setProperty("position","absolute","important");card.style.setProperty("left","50%","important");card.style.setProperty("top","50%","important");
  card.style.setProperty("width",`${measuredWidth}px`,`important`);card.style.setProperty("height",`${measuredHeight}px`,`important`);
  card.style.setProperty("min-width",`${measuredWidth}px`,`important`);card.style.setProperty("max-width",`${measuredWidth}px`,`important`);card.style.setProperty("aspect-ratio","auto","important");
  card.style.setProperty("margin","0","important");card.style.setProperty("border-radius","0","important");card.style.setProperty("box-shadow","none","important");
  card.style.setProperty("transform",`translate(-50%,-50%) scale(${scaleX},${scaleY})`,`important`);card.style.setProperty("transform-origin","center center","important");
  card.style.setProperty("print-color-adjust","exact","important");card.style.setProperty("-webkit-print-color-adjust","exact","important");
  return card;
 };
 for(let offset=0;offset<cardsByLearner.length;offset+=4){
  const sheet=document.createElement("section");sheet.className="learner-id-batch-print-sheet";
  cardsByLearner.slice(offset,offset+4).forEach(item=>{
   const pair=document.createElement("div");pair.className="learner-id-batch-print-pair";pair.setAttribute("aria-label",item.name);
   const front=document.createElement("div");front.className="learner-id-batch-print-card";front.appendChild(prepareCard(item.front));
   const back=document.createElement("div");back.className="learner-id-batch-print-card";back.appendChild(prepareCard(item.back));
   pair.append(front,back);sheet.appendChild(pair);
  });
  output.appendChild(sheet);
 }
 const batchCss=`html,body{height:auto!important;min-height:0!important}
 #learnerIdBatchPrintOutput{display:block!important;position:static!important;width:297mm!important;height:auto!important;margin:0!important;padding:0!important}
 #learnerIdBatchPrintOutput .learner-id-batch-print-sheet{display:grid!important;position:relative!important;box-sizing:border-box!important;width:297mm!important;height:210mm!important;min-height:210mm!important;max-height:210mm!important;grid-template-columns:111mm 111mm!important;grid-template-rows:85.6mm 85.6mm!important;column-gap:4mm!important;row-gap:4mm!important;justify-content:center!important;align-content:center!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#fff!important;break-inside:avoid!important;page-break-inside:avoid!important}
 #learnerIdBatchPrintOutput .learner-id-batch-print-sheet:not(:last-child){break-after:page!important;page-break-after:always!important}
 #learnerIdBatchPrintOutput .learner-id-batch-print-sheet:last-child{break-after:auto!important;page-break-after:auto!important}
 #learnerIdBatchPrintOutput .learner-id-batch-print-pair{display:grid!important;position:relative!important;grid-template-columns:54mm 54mm!important;column-gap:3mm!important;width:111mm!important;height:85.6mm!important;margin:0!important;padding:0!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important}
 #learnerIdBatchPrintOutput .learner-id-batch-print-card{position:relative!important;width:54mm!important;height:85.6mm!important;min-width:54mm!important;max-width:54mm!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important}
 #learnerIdBatchPrintOutput .tnhs-id-card{display:block!important;box-sizing:border-box!important;overflow:hidden!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}`;
 closeLearnerIdBatch();
 try{await printLearnerIdInIsolatedFrame(output,"A4 landscape",batchCss,"@page{size:297mm 210mm;margin:0}")}
 catch(error){console.error("Batch learner ID print failed",error);showToast("Unable to open the batch print preview.")}
}
function handleLearnerIdBatchListChange(event){
 const input=event.target.closest("input[data-learner-id-batch-record]");if(!input)return;
 const id=String(input.dataset.learnerIdBatchRecord||"");if(!id)return;
 if(input.checked)learnerIdBatchSelection.add(id);else learnerIdBatchSelection.delete(id);
 updateLearnerIdBatchSummary();
}

function openLearnerIdPrintOptions(){const panel=document.getElementById("learnerIdPrintPanel");if(!panel)return;panel.hidden=false;updateLearnerIdPrintSummary();document.getElementById("learnerIdPrintMethod")?.focus()}
function closeLearnerIdPrintOptions(){const panel=document.getElementById("learnerIdPrintPanel");if(panel)panel.hidden=true}
function updateLearnerIdPrintSummary(){const method=document.getElementById("learnerIdPrintMethod")?.value||"ordinary",orientation=document.getElementById("learnerIdPrintOrientation")?.value||"portrait",sides=document.getElementById("learnerIdPrintSides")?.value||"both",summary=document.getElementById("learnerIdPrintSummary");if(!summary)return;const methodText=method==="ordinary"?"A4 proof sheet":method==="shop"?"CR80 print-shop output":"CR80 PVC card";summary.textContent=`${methodText} · ${orientation} · ${sides==="both"?(method==="ordinary"?"front and back side by side on one A4 sheet":"front and back on separate card pages"):sides==="front"?"front only":"back only"}`}
function printLearnerId(){const area=document.getElementById("learnerIdPreview");if(!area?.querySelector(".tnhs-id-card"))return;openLearnerIdPrintOptions()}
async function confirmLearnerIdPrint(){
 const area=document.getElementById("learnerIdPreview");
 if(!area?.querySelector(".tnhs-id-card"))return;
 const method=document.getElementById("learnerIdPrintMethod")?.value||"ordinary";
 const orientation=document.getElementById("learnerIdPrintOrientation")?.value||"portrait";
 const sides=document.getElementById("learnerIdPrintSides")?.value||"both";
 const cards=Array.from(area.querySelectorAll(":scope > .tnhs-id-card"));
 const selected=cards.filter((card,index)=>!(sides==="front"&&index===1)&&!(sides==="back"&&index===0));
 if(!selected.length)return;
 const output=document.createElement("div");
 output.id="learnerIdPrintOutput";
 output.setAttribute("aria-hidden","true");
 const sourceWidth=cards[0].getBoundingClientRect().width||400;
 const sourceHeight=cards[0].getBoundingClientRect().height||sourceWidth/0.645;
 const cardWidth=54,cardHeight=85.6;
 const isA4=method==="ordinary";
 
 
 const pageWidth=isA4?297:(orientation==="portrait"?cardWidth:cardHeight);
 const pageHeight=isA4?210:(orientation==="portrait"?cardHeight:cardWidth);
 
 const sourceWidthMm=sourceWidth*25.4/96,sourceHeightMm=sourceHeight*25.4/96;
 const scaleX=cardWidth/sourceWidthMm,scaleY=cardHeight/sourceHeightMm;
 const makeCard=(source)=>{
  const clone=source.cloneNode(true);
  clone.removeAttribute("hidden");
  
  
  
  clone.style.setProperty("position","absolute","important");
  clone.style.setProperty("left","50%","important");
  clone.style.setProperty("top","50%","important");
  clone.style.setProperty("width",`${sourceWidth}px`,`important`);
  clone.style.setProperty("height",`${sourceHeight}px`,`important`);
  clone.style.setProperty("min-width",`${sourceWidth}px`,`important`);
  clone.style.setProperty("max-width",`${sourceWidth}px`,`important`);
  clone.style.setProperty("aspect-ratio","auto","important");
  clone.style.setProperty("margin","0","important");
  clone.style.setProperty("border-radius","0","important");
  clone.style.setProperty("box-shadow","none","important");
  const rotation=!isA4&&orientation==="landscape"?" rotate(90deg)":"";
  clone.style.setProperty("transform",`translate(-50%,-50%)${rotation} scale(${scaleX},${scaleY})`,"important");
  clone.style.setProperty("transform-origin","center center","important");
  clone.style.setProperty("print-color-adjust","exact","important");
  clone.style.setProperty("-webkit-print-color-adjust","exact","important");
  return clone;
 };
 if(isA4){
  const sheet=document.createElement("div");sheet.className="learner-id-print-sheet learner-id-print-a4";
  selected.forEach(card=>{const slot=document.createElement("div");slot.className="learner-id-print-slot learner-id-print-a4-card";slot.appendChild(makeCard(card));sheet.appendChild(slot)});
  output.appendChild(sheet);
 }else{
  selected.forEach(card=>{const page=document.createElement("div");page.className="learner-id-print-sheet learner-id-print-card-page";const slot=document.createElement("div");slot.className="learner-id-print-slot";slot.appendChild(makeCard(card));page.appendChild(slot);output.appendChild(page)});
 }
 const pageSize=isA4?"A4 landscape":`${pageWidth}mm ${pageHeight}mm`;
 const slotWidth=isA4?cardWidth:(orientation==="portrait"?cardWidth:cardHeight);
 const slotHeight=isA4?cardHeight:(orientation==="portrait"?cardHeight:cardWidth);
 const individualCss=`#learnerIdPrintOutput{width:${pageWidth}mm!important;height:${pageHeight}mm!important;margin:0!important;padding:0!important}
 #learnerIdPrintOutput .learner-id-print-sheet{position:relative!important;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:center!important;gap:4mm!important;width:${pageWidth}mm!important;height:${pageHeight}mm!important;min-height:${pageHeight}mm!important;max-height:${pageHeight}mm!important;margin:0!important;padding:0!important;box-sizing:border-box!important;overflow:hidden!important;background:#fff!important;break-after:page!important;page-break-after:always!important}
 #learnerIdPrintOutput .learner-id-print-sheet:last-child{break-after:auto!important;page-break-after:auto!important}
 #learnerIdPrintOutput .learner-id-print-slot{position:relative!important;flex:0 0 ${slotWidth}mm!important;width:${slotWidth}mm!important;height:${slotHeight}mm!important;overflow:hidden!important;break-inside:avoid!important;page-break-inside:avoid!important}
 #learnerIdPrintOutput .tnhs-id-card{display:block!important;overflow:hidden!important;box-sizing:border-box!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}`;
 closeLearnerIdPrintOptions();
 try{await printLearnerIdInIsolatedFrame(output,pageSize,individualCss,isA4?"@page{size:297mm 210mm;margin:0}":null)}
 catch(error){console.error("Learner ID print preparation failed",error);showToast("Unable to prepare the learner ID print output.")}
}
document.getElementById("openLearnerIdBatch")?.addEventListener("click",openLearnerIdBatch);document.getElementById("closeLearnerIdBatch")?.addEventListener("click",closeLearnerIdBatch);document.getElementById("learnerIdBatchMethod")?.addEventListener("change",updateLearnerIdBatchMethodUI);document.getElementById("learnerIdBatchGrade")?.addEventListener("change",()=>{populateLearnerIdBatchFilters();renderLearnerIdBatchList()});document.getElementById("learnerIdBatchSection")?.addEventListener("change",renderLearnerIdBatchList);document.getElementById("addLearnerIdBatchGroup")?.addEventListener("click",addLearnerIdBatchGradeSection);document.getElementById("clearLearnerIdBatch")?.addEventListener("click",clearLearnerIdBatchSelection);document.getElementById("finishLearnerIdBatchSelection")?.addEventListener("click",finishLearnerIdBatchSelection);document.getElementById("learnerIdBatchList")?.addEventListener("change",handleLearnerIdBatchListChange);
document.getElementById("closeLearnerIdPrint")?.addEventListener("click",closeLearnerIdPrintOptions);document.getElementById("cancelLearnerIdPrint")?.addEventListener("click",closeLearnerIdPrintOptions);["learnerIdPrintMethod","learnerIdPrintOrientation","learnerIdPrintSides"].forEach(id=>document.getElementById(id)?.addEventListener("change",updateLearnerIdPrintSummary));document.getElementById("confirmLearnerIdPrint")?.addEventListener("click",confirmLearnerIdPrint);
document.getElementById("idPrincipalSignatureFile")?.addEventListener("change",e=>{const file=e.target.files&&e.target.files[0];if(!file)return;if(!/^image\/(png|jpeg|webp)$/.test(file.type)){showToast("Please choose a PNG, JPG, or WEBP image.");e.target.value="";return}if(file.size>5*1024*1024){showToast("Principal signature image must be 5 MB or smaller.");e.target.value="";return}const reader=new FileReader();reader.onload=()=>{window.pendingPrincipalSignatureDataUrl=String(reader.result||"");const preview=document.getElementById("idPrincipalSignaturePreview");if(preview)preview.src=window.pendingPrincipalSignatureDataUrl;const card=document.querySelector(".tnhs-id-signature-image");if(card)card.src=window.pendingPrincipalSignatureDataUrl;const status=document.getElementById("idConfigStatus");if(status)status.textContent="New signature selected. Click Save ID Details to keep it.";};reader.onerror=()=>showToast("Unable to read the selected signature image.");reader.readAsDataURL(file)});document.getElementById("saveIdConfig")?.addEventListener("click",saveIdConfig);document.getElementById("learnerIdSelect")?.addEventListener("change",renderLearnerIdPreview);document.getElementById("saveLearnerIdDetails")?.addEventListener("click",saveLearnerIdDetails);document.getElementById("printLearnerId")?.addEventListener("click",printLearnerId);


function censusDateKey(value){
 if(!value)return "";
 const d=new Date(value);if(Number.isNaN(d.getTime()))return "";
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
 const part=type=>parts.find(p=>p.type===type)?.value||"";
 return `${part("year")}-${part("month")}-${part("day")}`;
}
function renderCensus(){
 const yearEl=document.getElementById("censusYear");if(!yearEl)return;
 const records=getActiveRecords(),today=new Date();
 const currentStartYear=today.getMonth()>=5?today.getFullYear():today.getFullYear()-1;
 const currentSchoolYear=`${currentStartYear}-${currentStartYear+1}`;
 const years=[...new Set([...records.map(r=>r.schoolYear).filter(Boolean),currentSchoolYear])].sort().reverse();
 const initialized=yearEl.dataset.censusInitialized==="true",previousSelection=yearEl.value;
 yearEl.innerHTML='<option value="">All School Years</option>'+years.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join("");
 if(initialized)yearEl.value=previousSelection;else{yearEl.value=currentSchoolYear;yearEl.dataset.censusInitialized="true";}
 const selected=yearEl.value,from=document.getElementById("censusDateFrom")?.value||"",to=document.getElementById("censusDateTo")?.value||"";
 const schoolYearData=records.filter(r=>!selected||r.schoolYear===selected);
 const data=schoolYearData.filter(r=>{const key=censusDateKey(r.createdAt);return (!from||key>=from)&&(!to||key<=to);});
 const groups=new Map();
 for(const r of data){
  const grade=String(r.gradeLevel||"Unspecified"),track=String(r.track||"Unspecified"),strand=String(r.strand||"Unspecified");
  const key=[grade,track.toLowerCase(),strand.toLowerCase()].join("\u0000");
  if(!groups.has(key))groups.set(key,{grade,track,strand,male:0,female:0,other:0,total:0});
  const g=groups.get(key);g.total++;const sex=String(r.sex||"").trim().toLowerCase();
  if(sex==="male")g.male++;else if(sex==="female")g.female++;else g.other++;
 }
 const rows=[...groups.values()].sort((a,b)=>a.grade.localeCompare(b.grade,undefined,{numeric:true})||a.track.localeCompare(b.track)||a.strand.localeCompare(b.strand));
 const male=data.filter(r=>String(r.sex||"").trim().toLowerCase()==="male").length;
 const female=data.filter(r=>String(r.sex||"").trim().toLowerCase()==="female").length;
 const other=data.length-male-female,total=data.length;
 document.getElementById("censusSummary").innerHTML=[["Active Enrollments",total],["Male",male],["Female",female],["Other / Unspecified Sex",other]].map(([label,n])=>`<div class="census-stat"><small>${label}</small><strong>${n}</strong></div>`).join("");
 document.getElementById("censusTableBody").innerHTML=rows.length?rows.map(r=>`<tr><td>Grade ${esc(r.grade)}</td><td>${esc(r.track)}</td><td>${esc(r.strand)}</td><td>${r.male}</td><td>${r.female}</td><td>${r.other}</td><td><strong>${r.total}</strong></td></tr>`).join(""):'<tr><td colspan="7">No active enrollment records found for this selection.</td></tr>';
 document.getElementById("censusTableFoot").innerHTML=`<tr><th colspan="3">Overall Total</th><th>${male}</th><th>${female}</th><th>${other}</th><th>${total}</th></tr>`;
 const daily=new Map(),breakdown=new Map();
 for(const r of data){
  const date=censusDateKey(r.createdAt);if(!date)continue;
  if(!daily.has(date))daily.set(date,{date,g11:0,g12:0,other:0,total:0});
  const day=daily.get(date);day.total++;
  const grade=String(r.gradeLevel||"").trim().toLowerCase();
  if(grade==="11"||grade==="grade 11"||grade==="grade 11 (old curriculum)")day.g11++;
  else if(grade==="12"||grade==="grade 12"||grade==="grade 12 (old curriculum)")day.g12++;
  else day.other++;
  const fields=[date,String(r.gradeLevel||"Unspecified"),String(r.track||"Unspecified"),String(r.strand||"Unspecified"),String(r.sectionName||"Unassigned")];
  const key=fields.map(v=>v.toLowerCase()).join("\u0000");
  if(!breakdown.has(key))breakdown.set(key,{date,grade:fields[1],track:fields[2],cluster:fields[3],section:fields[4],total:0});
  breakdown.get(key).total++;
 }
 const dailyRows=[...daily.values()].sort((a,b)=>b.date.localeCompare(a.date));
 const dailyTotal=dailyRows.reduce((sum,r)=>sum+r.total,0),days=dailyRows.length;
 const peak=dailyRows.reduce((best,r)=>!best||r.total>best.total?r:best,null);
 const avg=days?(dailyTotal/days).toFixed(1):"0.0";
 document.getElementById("dailyCensusSummary").innerHTML=[["New Enrollments",dailyTotal],["Days with Enrollments",days],["Average per Active Day",avg],["Highest Daily Count",peak?`${peak.total} (${peak.date})`:"—"]].map(([label,n])=>`<div class="census-stat"><small>${label}</small><strong>${n}</strong></div>`).join("");
 document.getElementById("dailyCensusTableBody").innerHTML=dailyRows.length?dailyRows.map(r=>`<tr><td>${esc(r.date)}</td><td>${r.g11}</td><td>${r.g12}</td><td>${r.other}</td><td><strong>${r.total}</strong></td></tr>`).join(""):'<tr><td colspan="5">No new enrollment records found for this selection.</td></tr>';
 document.getElementById("dailyCensusTableFoot").innerHTML=`<tr><th>Period Total</th><th>${dailyRows.reduce((s,r)=>s+r.g11,0)}</th><th>${dailyRows.reduce((s,r)=>s+r.g12,0)}</th><th>${dailyRows.reduce((s,r)=>s+r.other,0)}</th><th>${dailyTotal}</th></tr>`;
 const detailRows=[...breakdown.values()].sort((a,b)=>b.date.localeCompare(a.date)||a.grade.localeCompare(b.grade,undefined,{numeric:true})||a.track.localeCompare(b.track)||a.cluster.localeCompare(b.cluster)||a.section.localeCompare(b.section));
 document.getElementById("dailyCensusBreakdownBody").innerHTML=detailRows.length?detailRows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.grade)}</td><td>${esc(r.track)}</td><td>${esc(r.cluster)}</td><td>${esc(r.section)}</td><td><strong>${r.total}</strong></td></tr>`).join(""):'<tr><td colspan="6">No daily breakdown available.</td></tr>';
 const note=document.getElementById("censusPrintYear");if(note)note.textContent=selected||"All School Years";
 const dateNote=document.getElementById("censusPrintDateRange");if(dateNote)dateNote.textContent=from||to?`${from||"Beginning"} to ${to||"Present"}`:"All dates";
}
function populateStrandOptions(trackValue,strandValue=""){const strand=document.getElementById("strand");if(!strand)return;const options=SSHS_CLUSTERS[trackValue]||[];strand.innerHTML='<option value="">'+(trackValue?"Select strand":"Select a track first")+'</option>'+options.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");strand.disabled=!trackValue||!options.length;if(strandValue&&options.includes(strandValue))strand.value=strandValue;}
document.getElementById("track")?.addEventListener("change",e=>populateStrandOptions(e.target.value));
document.addEventListener("change",e=>{if(e.target?.id!=="edit_track")return;const strand=document.getElementById("edit_strand");if(!strand)return;const options=SSHS_CLUSTERS[e.target.value]||[];strand.innerHTML='<option value="">'+(e.target.value?"Select strand":"Select a track first")+'</option>'+options.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");strand.disabled=!e.target.value||!options.length;});
function calculateLearnerAge(birthdate){if(!birthdate)return "";const born=new Date(`${birthdate}T00:00:00`);if(Number.isNaN(born.getTime()))return "";const today=new Date();let age=today.getFullYear()-born.getFullYear();const beforeBirthday=today.getMonth()<born.getMonth()||(today.getMonth()===born.getMonth()&&today.getDate()<born.getDate());if(beforeBirthday)age--;return age>=0?String(age):"";}
document.getElementById("birthdate")?.addEventListener("change",e=>{const age=document.getElementById("age");if(age)age.value=calculateLearnerAge(e.target.value);});

function exportCensusCsv(){
 const selected=document.getElementById("censusYear")?.value||"",from=document.getElementById("censusDateFrom")?.value||"",to=document.getElementById("censusDateTo")?.value||"";
 const data=getActiveRecords().filter(r=>(!selected||r.schoolYear===selected)&&(()=>{const key=censusDateKey(r.createdAt);return (!from||key>=from)&&(!to||key<=to)})());
 if(!data.length){showToast("There are no active enrollment records to export for this selection.");return}
 const groups=new Map();
 for(const r of data){const grade=String(r.gradeLevel||"Unspecified"),track=String(r.track||"Unspecified"),strand=String(r.strand||"Unspecified"),key=[grade,track.toLowerCase(),strand.toLowerCase()].join("\u0000");if(!groups.has(key))groups.set(key,{grade,track,strand,male:0,female:0,other:0,total:0});const g=groups.get(key);g.total++;const sex=String(r.sex||"").trim().toLowerCase();if(sex==="male")g.male++;else if(sex==="female")g.female++;else g.other++;}
 const rows=[...groups.values()].sort((a,b)=>a.grade.localeCompare(b.grade,undefined,{numeric:true})||a.track.localeCompare(b.track)||a.strand.localeCompare(b.strand));
 const lines=[["CURRENT ENROLLMENT SUMMARY"],["School Year Filter",selected||"All School Years"],["From Date",from||"All"],["To Date",to||"All"],[],["Grade Level","Track","Cluster / Historical Strand","Male","Female","Other / Unspecified","Total"],...rows.map(r=>[r.grade,r.track,r.strand,r.male,r.female,r.other,r.total]),[],["DAILY ENROLLMENT TOTALS"],["Enrollment Date","Grade 11","Grade 12","Other / Unspecified Grade","Total New Enrollments"]];
 const daily=new Map();
 for(const r of data){const date=censusDateKey(r.createdAt);if(!date)continue;if(!daily.has(date))daily.set(date,{date,g11:0,g12:0,other:0,total:0});const d=daily.get(date);d.total++;const g=String(r.gradeLevel||"").trim().toLowerCase();if(g==="11"||g==="grade 11"||g==="grade 11 (old curriculum)")d.g11++;else if(g==="12"||g==="grade 12"||g==="grade 12 (old curriculum)")d.g12++;else d.other++;}
 [...daily.values()].sort((a,b)=>b.date.localeCompare(a.date)).forEach(d=>lines.push([d.date,d.g11,d.g12,d.other,d.total]));
 lines.push([],["DAILY BREAKDOWN"],["Date","Grade Level","Track","Cluster / Historical Strand","Section","New Enrollments"]);
 const detail=new Map();
 for(const r of data){const date=censusDateKey(r.createdAt);if(!date)continue;const fields=[date,String(r.gradeLevel||"Unspecified"),String(r.track||"Unspecified"),String(r.strand||"Unspecified"),String(r.sectionName||"Unassigned")],key=fields.map(v=>v.toLowerCase()).join("\u0000");if(!detail.has(key))detail.set(key,{fields,total:0});detail.get(key).total++;}
 [...detail.values()].sort((a,b)=>b.fields[0].localeCompare(a.fields[0])||a.fields[1].localeCompare(b.fields[1],undefined,{numeric:true})).forEach(d=>lines.push([...d.fields,d.total]));
 const csv=lines.map(row=>row.map(csvCell).join(",")).join("\r\n"),blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`TNHS-enrollment-census-${(selected||"all-years").replace(/[^0-9-]/g,"")}-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1500);showToast(`Exported census and daily enrollment report for ${data.length} active records.`);
}

function selectCensusTab(name){
 const valid=["overview","daily","details"];if(!valid.includes(name))return;
 document.querySelectorAll("[data-census-tab]").forEach(tab=>{const active=tab.dataset.censusTab===name;tab.classList.toggle("active",active);tab.setAttribute("aria-selected",active?"true":"false");tab.tabIndex=active?0:-1;});
 document.querySelectorAll("[data-census-panel]").forEach(panel=>{const active=panel.dataset.censusPanel===name;panel.hidden=!active;panel.classList.toggle("active",active);});
}
document.querySelectorAll("[data-census-tab]").forEach(tab=>tab.addEventListener("click",()=>selectCensusTab(tab.dataset.censusTab)));
document.getElementById("census")?.querySelector(".census-tabs")?.addEventListener("keydown",event=>{
 if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
 const tabs=[...document.querySelectorAll("[data-census-tab]")],current=tabs.indexOf(document.activeElement);if(current<0)return;
 event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?tabs.length-1:(current+(event.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length;
 tabs[next].focus();selectCensusTab(tabs[next].dataset.censusTab);
});
selectCensusTab("overview");
document.getElementById("censusYear")?.addEventListener("change",renderCensus);document.getElementById("censusDateFrom")?.addEventListener("change",renderCensus);document.getElementById("censusDateTo")?.addEventListener("change",renderCensus);
async function refreshCensus(){
 const button=document.getElementById("refreshCensus");
 if(button?.disabled)return;
 if(button)button.disabled=true;
 try{
  const {data,error}=await supabaseClient.from("enrollment_records").select("*").order("updated_at",{ascending:false});
  if(error)throw error;
  recordsCache=data.map(rowToRecord);
  renderCensus();
  showToast("Census refreshed from the latest enrollment records.");
 }catch(error){
  console.error("Census refresh failed:",error);
  showToast(`Unable to refresh census: ${error.message||"Please try again."}`);
 }finally{
  if(button)button.disabled=false;
 }
}
document.getElementById("refreshCensus")?.addEventListener("click",refreshCensus);
const censusReportTitles={
 overview:"Enrollment Overview Report",
 daily:"Daily Enrollment Census Report",
 details:"Detailed Enrollment Breakdown Report"
};
document.querySelectorAll("[data-census-print]").forEach(button=>{
 button.addEventListener("click",()=>{
  const report=button.dataset.censusPrint;
  if(!Object.prototype.hasOwnProperty.call(censusReportTitles,report))return;
  renderCensus();
  const heading=document.querySelector("#census .census-print-heading");
  const title=heading?.querySelector("h2");
  const originalTitle=title?.textContent||"Senior High School Enrollment Census";
  if(title)title.textContent=censusReportTitles[report];
  const oldGenerated=heading?.querySelector("#censusPrintGenerated");
  const generated=document.createElement("p");
  generated.id="censusPrintGenerated";
  generated.innerHTML=`Generated: <strong>${new Intl.DateTimeFormat("en-PH",{dateStyle:"long",timeStyle:"short",timeZone:"Asia/Manila"}).format(new Date())}</strong>`;
  if(heading)heading.appendChild(generated);

  document.body.dataset.censusPrintReport=report;
  document.body.classList.add("census-printing");
  const style=document.createElement("style");
  style.id="censusPrintPageSetup";
  const pageSize=report==="details"?"legal landscape":"legal portrait";
  style.textContent=`@page{size:${pageSize};margin:12mm 12mm 16mm}
   @media print{
    body.census-printing #census{display:block!important;width:100%!important;max-width:none!important;box-sizing:border-box!important;padding:0!important;margin:0!important;background:#fff!important}
    body.census-printing #census .records-intro,
    body.census-printing #census .records-toolbar,
    body.census-printing #census .census-tabs,
    body.census-printing #census .census-print-action{display:none!important}
    body.census-printing #census .census-print-heading{display:block!important;margin:0 0 8mm!important}
    body.census-printing #census .census-print-heading h1{font-size:21pt!important;line-height:1.2!important;margin:0 0 3mm!important;color:#111!important}
    body.census-printing #census .census-print-heading h2{font-size:15pt!important;line-height:1.25!important;margin:0 0 3mm!important;color:#111!important}
    body.census-printing #census .census-print-heading p{font-size:9.5pt!important;margin:1mm 0!important;color:#222!important}
                                                                              
                                                                             
    body.census-printing #census #censusPanelOverview,
    body.census-printing #census #censusPanelDaily,
    body.census-printing #census #censusPanelDetails{display:none!important;visibility:hidden!important;border:0!important;padding:0!important;margin:0!important}
    body.census-printing[data-census-print-report="overview"] #census #censusPanelOverview,
    body.census-printing[data-census-print-report="daily"] #census #censusPanelDaily,
    body.census-printing[data-census-print-report="details"] #census #censusPanelDetails{display:block!important;visibility:visible!important}
    body.census-printing #census .census-panel-heading{display:block!important;margin:0 0 4mm!important}
    body.census-printing #census .census-panel-heading h3{font-size:13pt!important;margin:0 0 1mm!important;color:#111!important}
    body.census-printing #census .census-panel-heading p{font-size:9pt!important;margin:0!important;color:#333!important}
    body.census-printing #census .records-table-wrap{display:block!important;width:100%!important;overflow:visible!important;margin-top:2mm!important}
    body.census-printing #census .records-table{width:100%!important;min-width:0!important;table-layout:auto!important;border-collapse:collapse!important}
    body.census-printing #census .records-table thead{display:table-header-group!important}
    body.census-printing #census .records-table tfoot{display:table-footer-group!important}
    body.census-printing #census .records-table tr{break-inside:avoid!important;page-break-inside:avoid!important}
    body.census-printing #census .records-table th,
    body.census-printing #census .records-table td{font-size:9pt!important;line-height:1.3!important;padding:2.2mm 1.7mm!important;border:1px solid #777!important;color:#111!important;white-space:normal!important;overflow-wrap:anywhere!important}
    body.census-printing #census .records-table th{font-weight:700!important;background:#eee!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body.census-printing #census .records-table tfoot th,
    body.census-printing #census .records-table tfoot td{font-weight:800!important}
    body.census-printing #census .census-summary-grid{display:flex!important;flex-wrap:wrap!important;gap:4mm!important;margin:5mm 0!important}
    body.census-printing #census .census-stat{flex:1 1 30%!important;min-width:35mm!important;padding:3mm!important;border:1px solid #888!important;box-shadow:none!important}
    body.census-printing #census .census-stat small{font-size:8pt!important}
    body.census-printing #census .census-stat strong{font-size:17pt!important}
    body.census-printing #census .census-note{font-size:8.5pt!important;line-height:1.4!important;margin-top:4mm!important;color:#333!important}
    @page{@bottom-right{content:"Page " counter(page) " of " counter(pages);font-size:8pt}}
   }`;
  document.head.appendChild(style);
  const cleanup=()=>{
   document.body.classList.remove("census-printing");
   delete document.body.dataset.censusPrintReport;
   style.remove();
   if(title)title.textContent=originalTitle;
   generated.remove();
  };
  window.addEventListener("afterprint",cleanup,{once:true});
  window.print();
  setTimeout(()=>{if(document.body.classList.contains("census-printing"))cleanup();},120000);
 });
});


populateSchoolYearDropdown();

renderSettings();





const reportStatusLabels=["Active","Stopped","Dropped out","Permanently stopped","Transferred out"];
let reportsStatusHistory=[];
let reportsHistoryLoaded=false;
let reportsHistoryError="";
let activeReportsTab="overview";
function reportSchoolYearRecords(){
 const year=document.getElementById("reportsYear")?.value||"";
 return getActiveRecords().filter(r=>!year||String(r.schoolYear||"")===year);
}
function reportLearnerName(r){
 return [r.lastName,r.firstName,r.middleName,r.extensionName].filter(Boolean).join(", ")||"Unnamed learner";
}
function reportStat(label,value){
 return `<div class="census-stat"><small>${esc(label)}</small><strong>${Number(value)||0}</strong></div>`;
}
function reportMiniChart(title,subtitle,items,options={}){
 const max=Math.max(1,...items.map(x=>Number(x.value)||0));
 const total=options.total==null?items.reduce((n,x)=>n+(Number(x.value)||0),0):Number(options.total);
 const rows=items.length?items.map(item=>{
  const value=Number(item.value)||0,share=total>0?value/total*100:0;
  return `<div class="reports-chart-row"><div class="reports-chart-label"><span>${esc(item.label)}</span><strong>${options.percent?share.toFixed(1)+"%":value.toLocaleString()}</strong></div><div class="reports-chart-track"><span style="width:${Math.max(0,Math.min(100,value/max*100))}%"></span></div></div>`;
 }).join(""):'<p class="reports-chart-empty">No data available for this selection.</p>';
 return `<section class="reports-chart-card"><div class="reports-chart-head"><div><h4>${esc(title)}</h4><p>${esc(subtitle||"")}</p></div></div>${rows}</section>`;
}
function reportRate(numerator,denominator){return denominator>0?(numerator/denominator*100):0;}
function renderReports(){
 const yearEl=document.getElementById("reportsYear");if(!yearEl)return;
 const all=getActiveRecords();
 const years=[...new Set(all.map(r=>r.schoolYear).filter(Boolean))].sort().reverse();
 const previous=yearEl.value;
 yearEl.innerHTML='<option value="">All School Years</option>'+years.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join("");
 if(years.includes(previous))yearEl.value=previous;
 const data=reportSchoolYearRecords();
 const countByStatus=(rows,status)=>rows.filter(r=>String(r.status||"Active").toLowerCase()===status.toLowerCase()).length;
 const total=data.length, active=countByStatus(data,"Active");
 const counts=reportStatusLabels.map(s=>[s,countByStatus(data,s)]);
 const returnees=data.filter(r=>r.returning===true||r.returning==="Yes");
 document.getElementById("reportsOverviewStats").innerHTML=reportStat("Total Learner Records",total)+reportStat("Active Learners",active)+reportStat("Returnees",returnees.length);
 document.getElementById("reportsOverviewBody").innerHTML=counts.map(([s,n])=>`<tr><td>${esc(s)}</td><td>${n}</td></tr>`).join("")||'<tr><td colspan="2">No learner records found.</td></tr>';
 const comparisonYears=[...new Set(all.map(r=>r.schoolYear).filter(Boolean))].sort().reverse();
 document.getElementById("reportsYearComparisonBody").innerHTML=comparisonYears.map(y=>{
  const rows=all.filter(r=>String(r.schoolYear)===String(y));
  const c=status=>countByStatus(rows,status);
  const returned=rows.filter(r=>r.returning===true||r.returning==="Yes").length;
  return `<tr><td>${esc(y)}</td><td>${rows.length}</td><td>${c("Active")}</td><td>${c("Stopped")}</td><td>${c("Dropped out")}</td><td>${c("Permanently stopped")}</td><td>${c("Transferred out")}</td><td>${returned}</td></tr>`;
 }).join("")||'<tr><td colspan="8">No school-year records available.</td></tr>';
 const overviewChartItems=counts.map(([label,value])=>({label,value})).filter(x=>x.value>0);
 const yearItems=comparisonYears.slice().reverse().map(y=>({label:y,value:all.filter(r=>String(r.schoolYear)===String(y)).length}));
 document.getElementById("reportsOverviewCharts").innerHTML=
  reportMiniChart("Current learner status distribution","Share of records by latest recorded status",overviewChartItems,{total:total,percent:true})+
  reportMiniChart("Learner records by school year","Historical enrollment-record volume; records may represent the same learner in different years",yearItems);
 document.getElementById("reportsReturneeStats").innerHTML=reportStat("Returnees",returnees.length);
 document.getElementById("reportsReturneeBody").innerHTML=returnees.map(r=>`<tr><td>${esc(reportLearnerName(r))}</td><td>${esc(r.lrn||"—")}</td><td>${esc(r.gradeLevel||"—")}</td><td>${esc(r.sectionName||"—")}</td><td>${esc(r.schoolYear||"—")}</td><td>${esc(r.status||"Active")}</td></tr>`).join("")||'<tr><td colspan="6">No returnees found for this selection.</td></tr>';
 const answered=data.filter(r=>r.returning==="Yes"||r.returning==="No"||r.returning===true||r.returning===false);
 const yesCount=answered.filter(r=>r.returning===true||r.returning==="Yes").length;
 const noCount=answered.length-yesCount;
 const returneeRate=reportRate(yesCount,answered.length);
 const gradeCounts=new Map();
 returnees.forEach(r=>{const g=String(r.gradeLevel||"Unspecified");gradeCounts.set(g,(gradeCounts.get(g)||0)+1)});
 const gradeItems=[...gradeCounts.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),undefined,{numeric:true})).map(([label,value])=>({label,value}));
 document.getElementById("reportsReturneeCharts").innerHTML=
  `<section class="reports-chart-card reports-rate-card"><div class="reports-chart-head"><div><h4>Balik-Aral share</h4><p>Returnees among records with a recorded Yes/No answer</p></div></div><div class="reports-rate-value">${returneeRate.toFixed(1)}<span>%</span></div><p class="reports-rate-caption">${yesCount} returnees out of ${answered.length} answered records</p></section>`+
  reportMiniChart("Returnees by grade level","Number of records marked Returning (Balik-Aral) = Yes",gradeItems);
 const year=yearEl.value||"All School Years";
 document.getElementById("reportsPrintYear").textContent=year;
 renderReportsStatus();
 renderReportsExtended();
 setReportsTab(activeReportsTab);
}
function reportDistinctLrn(rows){return new Set(rows.map(r=>String(r.lrn||"").trim()).filter(Boolean));}
function reportSchoolYearParts(value){const m=String(value||"").match(/^(\d{4})[-–](\d{4})$/);return m?{start:Number(m[1]),end:Number(m[2])}:null;}
function renderReportsExtended(){
 const all=getActiveRecords();
 const selectedYear=document.getElementById("reportsYear")?.value||"";
 const rows=all.filter(r=>!selectedYear||String(r.schoolYear||"")===selectedYear);
 const status=r=>String(r.status||"Active");
 const isDrop=r=>["Dropped out","Stopped","Permanently stopped"].includes(status(r));
 const transferredIn=rows.filter(r=>String(r.enrollmentClassification||"Standard")==="Transferred in");
 const transferredOut=rows.filter(r=>status(r)==="Transferred out");
 const dropoutRows=rows.filter(isDrop);
 const statHtml=reportStat("Dropped Out",rows.filter(r=>status(r)==="Dropped out").length)+reportStat("Stopped",rows.filter(r=>status(r)==="Stopped").length)+reportStat("Permanently Stopped",rows.filter(r=>status(r)==="Permanently stopped").length)+reportStat("Transferred In",transferredIn.length)+reportStat("Transferred Out",transferredOut.length);
 const stats=document.getElementById("reportsMonitoringStats");if(stats)stats.innerHTML=statHtml;
 const makeRow=(r,extra="")=>`<tr><td>${esc(reportLearnerName(r))}</td><td>${esc(r.lrn||"—")}</td><td>${esc(r.gradeLevel||"—")}</td><td>${esc(r.schoolYear||"—")}</td>${extra}</tr>`;
 const dropBody=document.getElementById("reportsDropoutBody");if(dropBody)dropBody.innerHTML=dropoutRows.map(r=>`<tr><td>${esc(reportLearnerName(r))}</td><td>${esc(r.lrn||"—")}</td><td>${esc(status(r))}</td><td>${esc(r.gradeLevel||"—")}</td><td>${esc(r.schoolYear||"—")}</td><td>${esc(r.statusEffectiveDate||"—")}</td></tr>`).join("")||'<tr><td colspan="6">No dropout or stopped learners found.</td></tr>';
 const inBody=document.getElementById("reportsTransferredInBody");if(inBody)inBody.innerHTML=transferredIn.map(r=>makeRow(r,`<td>${esc(status(r))}</td>`)).join("")||'<tr><td colspan="5">No transferred-in learners found.</td></tr>';
 const outBody=document.getElementById("reportsTransferredOutBody");if(outBody)outBody.innerHTML=transferredOut.map(r=>`<tr><td>${esc(reportLearnerName(r))}</td><td>${esc(r.lrn||"—")}</td><td>${esc(r.gradeLevel||"—")}</td><td>${esc(r.schoolYear||"—")}</td><td>${esc(r.statusEffectiveDate||"—")}</td><td>${esc(r.statusReason||"—")}</td></tr>`).join("")||'<tr><td colspan="6">No transferred-out learners found.</td></tr>';
 
 const years=[...new Set(all.map(r=>String(r.schoolYear||"")).filter(y=>reportSchoolYearParts(y)))].sort((a,b)=>reportSchoolYearParts(a).start-reportSchoolYearParts(b).start);
 const cohortRows=[];
 for(let i=0;i<years.length-1;i++){
  const y=years[i],next=years[i+1],yp=reportSchoolYearParts(y),np=reportSchoolYearParts(next);
  if(np.start!==yp.end)continue;
  const cohort=all.filter(r=>String(r.schoolYear)===y),nextRows=all.filter(r=>String(r.schoolYear)===next);
  const original=reportDistinctLrn(cohort),eligibleNext=nextRows.filter(r=>!["Transferred in","Balik-Aral"].includes(String(r.enrollmentClassification||"Standard")));
  const continued=new Set([...reportDistinctLrn(eligibleNext)].filter(lrn=>original.has(lrn))).size;
  const rate=original.size?continued/original.size*100:0;
  cohortRows.push({year:y,original:original.size,continued,rate});
 }
 const retentionStats=document.getElementById("reportsRetentionStats");if(retentionStats){const latest=cohortRows[cohortRows.length-1];retentionStats.innerHTML=reportStat("Available Cohort Comparisons",cohortRows.length)+reportStat("Latest Starting Cohort",latest?.year||"—")+reportStat("Latest Preliminary Retention",latest?latest.rate.toFixed(1)+"%":"—");}
 const retentionBody=document.getElementById("reportsRetentionBody");if(retentionBody)retentionBody.innerHTML=cohortRows.map(x=>`<tr><td>${esc(x.year)}</td><td>${x.original}</td><td>${x.continued}</td><td>${x.rate.toFixed(1)}%</td></tr>`).join("")||'<tr><td colspan="4">No consecutive school-year cohorts are available yet.</td></tr>';
 const dropRateBody=document.getElementById("reportsDropoutRateBody");if(dropRateBody){const targets=selectedYear?[selectedYear]:years;dropRateBody.innerHTML=targets.map(y=>{const yr=all.filter(r=>String(r.schoolYear)===y),d=yr.filter(r=>status(r)==="Dropped out").length,rate=yr.length?d/yr.length*100:0;return `<tr><td>${esc(y)}</td><td>${d}</td><td>${yr.length}</td><td>${rate.toFixed(1)}%</td></tr>`}).join("")||'<tr><td colspan="4">No school-year data available.</td></tr>';}
 
 const quarterRows=[];for(let q=1;q<=4;q++){const qRows=rows.filter(r=>{const d=new Date(r.createdAt);return !Number.isNaN(d.getTime())&&Math.floor(d.getMonth()/3)+1===q});quarterRows.push({q,rows:qRows});}
 const quarterStats=document.getElementById("reportsQuarterlyStats");if(quarterStats)quarterStats.innerHTML=reportStat("Records in Selected School Year",rows.length)+reportStat("Quarter 1",quarterRows[0].rows.length)+reportStat("Quarter 2",quarterRows[1].rows.length)+reportStat("Quarter 3",quarterRows[2].rows.length)+reportStat("Quarter 4",quarterRows[3].rows.length);
 const quarterBody=document.getElementById("reportsQuarterlyBody");if(quarterBody)quarterBody.innerHTML=quarterRows.map(({q,rows:qRows})=>`<tr><td>Q${q} (Calendar)</td><td>${qRows.length}</td><td>${qRows.filter(r=>status(r)==="Active").length}</td><td>${qRows.filter(r=>status(r)==="Dropped out").length}</td><td>${qRows.filter(r=>status(r)==="Stopped").length}</td><td>${qRows.filter(r=>String(r.enrollmentClassification||"Standard")==="Transferred in").length}</td><td>${qRows.filter(r=>status(r)==="Transferred out").length}</td></tr>`).join("");
}
async function loadReportsStatusHistory(){
 const body=document.getElementById("reportsStatusBody");if(!body)return;
 body.innerHTML='<tr><td colspan="5">Loading status history…</td></tr>';
 reportsHistoryError="";
 try{
  const {data,error}=await supabaseClient.from("learner_status_history").select("record_id,previous_status,new_status,effective_date,reason,created_at").order("effective_date",{ascending:false}).limit(2000);
  if(error)throw error;
  reportsStatusHistory=data||[];reportsHistoryLoaded=true;
 }catch(error){
  reportsHistoryError=error.message||"Unable to retrieve status history.";
  reportsStatusHistory=[];reportsHistoryLoaded=false;
 }
 renderReportsStatus();
}
function renderReportsStatus(){
 const body=document.getElementById("reportsStatusBody");if(!body)return;
 const year=document.getElementById("reportsYear")?.value||"";
 if(reportsHistoryError){
  body.innerHTML=`<tr><td colspan="5">${esc(reportsHistoryError)}</td></tr>`;
  document.getElementById("reportsStatusStats").innerHTML=reportStat("History unavailable",0);
  document.getElementById("reportsStatusCharts").innerHTML='<section class="reports-chart-card"><p class="reports-chart-empty">Charts are unavailable because status history could not be loaded.</p></section>';
  return;
 }
 const yearMatch=String(year).match(/^(\d{4})[-–](\d{4})$/);
 const start=yearMatch?`${yearMatch[1]}-06-01`:"",end=yearMatch?`${yearMatch[2]}-05-31`:"";
 const filtered=reportsStatusHistory.filter(h=>{const date=String(h.effective_date||"");return !year||(start&&date>=start&&date<=end)});
 document.getElementById("reportsStatusStats").innerHTML=reportStat("Recorded Status Changes",filtered.length);
 body.innerHTML=filtered.map(h=>`<tr><td>${esc(h.effective_date||"—")}</td><td>${esc(h.record_id||"—")}</td><td>${esc(h.previous_status||"—")}</td><td>${esc(h.new_status||"—")}</td><td>${esc(h.reason||"—")}</td></tr>`).join("")||'<tr><td colspan="5">No status changes found for this selection.</td></tr>';
 const statusCounts=new Map();
 filtered.forEach(h=>{const label=String(h.new_status||"Unspecified");statusCounts.set(label,(statusCounts.get(label)||0)+1)});
 const statusItems=[...statusCounts.entries()].sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));
 document.getElementById("reportsStatusCharts").innerHTML=reportMiniChart("Status changes by resulting status","Count of recorded changes grouped by the new status",statusItems);
}
function setReportsTab(tab){
 if(!["overview","status","returnees","monitoring","retention","quarterly"].includes(tab))return;
 activeReportsTab=tab;
 const section=tab==="overview"?"overview":["status","returnees","monitoring"].includes(tab)?"movement":"trends";
 document.querySelectorAll("[data-report-section]").forEach(b=>{const active=b.dataset.reportSection===section;b.classList.toggle("active",active);b.setAttribute("aria-pressed",active?"true":"false")});
 document.querySelectorAll("[data-report-subnav]").forEach(nav=>{nav.hidden=nav.dataset.reportSubnav!==section});
 document.querySelectorAll("[data-report-tab]").forEach(b=>{const active=b.dataset.reportTab===tab;b.classList.toggle("active",active);b.setAttribute("aria-selected",active?"true":"false")});
 document.querySelectorAll("[data-report-panel]").forEach(p=>{const active=p.dataset.reportPanel===tab;p.hidden=!active;p.classList.toggle("active",active)});
 const titles={overview:"Learner Statistics Overview",status:"Learner Status Report",returnees:"Balik-Aral / Returnee Report",monitoring:"Dropout and Transferee Monitoring",retention:"Retention and Dropout Statistics",quarterly:"Quarterly Enrollment Activity"};
 const title=titles[tab];document.getElementById("reportsPrintTitle").textContent=title;
}
document.querySelectorAll("[data-report-section]").forEach(b=>b.addEventListener("click",()=>setReportsTab(({overview:"overview",movement:"status",trends:"retention"})[b.dataset.reportSection])));
document.querySelectorAll("[data-report-tab]").forEach(b=>b.addEventListener("click",()=>setReportsTab(b.dataset.reportTab)));
document.getElementById("reportsYear")?.addEventListener("change",()=>renderReports());
document.getElementById("refreshReports")?.addEventListener("click",async()=>{
 const button=document.getElementById("refreshReports");button.disabled=true;
 try{
  const {data,error}=await supabaseClient.from("enrollment_records").select("*").order("updated_at",{ascending:false});
  if(error)throw error;
  recordsCache=data.map(rowToRecord);
  reportsHistoryLoaded=false;
  renderReports();
  showToast("Reports refreshed from the latest enrollment records.");
 }catch(error){showToast(`Unable to refresh reports: ${error.message||"Please try again."}`)}
 finally{button.disabled=false}
});
document.querySelector('[data-page="reports"]')?.addEventListener("click",()=>{if(!reportsHistoryLoaded&&!reportsHistoryError)loadReportsStatusHistory()});
document.querySelectorAll("[data-report-print]").forEach(button=>button.addEventListener("click",()=>{
 const report=button.dataset.reportPrint;
 if(!["overview","status","returnees","monitoring","retention","quarterly"].includes(report))return;
 setReportsTab(report);
 const pageTitles={overview:"Learner Statistics Overview",status:"Learner Status Report",returnees:"Balik-Aral / Returnee Report",monitoring:"Dropout and Transferee Monitoring",retention:"Retention and Dropout Statistics",quarterly:"Quarterly Enrollment Activity"};
 document.body.dataset.reportsPrint=report;
 document.body.classList.add("reports-printing");
 const style=document.createElement("style");style.id="reportsPrintSetup";
 const pageSize=["overview","monitoring","retention","quarterly"].includes(report)?"legal landscape":"legal portrait";
 style.textContent=`@page{size:${pageSize};margin:12mm 12mm 16mm}@media print{
 body.reports-printing *{visibility:hidden!important}
 body.reports-printing #reports,body.reports-printing #reports *{visibility:visible!important}
 body.reports-printing #reports{display:block!important;position:absolute!important;inset:0!important;width:100%!important;max-width:none!important;padding:0!important;margin:0!important;background:#fff!important}
 body.reports-printing #reports .records-intro,body.reports-printing #reports .reports-toolbar,body.reports-printing #reports .reports-tabs,body.reports-printing #reports .reports-section-tabs,body.reports-printing #reports .reports-subnav,body.reports-printing #reports .reports-print-action,body.reports-printing #reports #reportsMessage{display:none!important}
 body.reports-printing #reports .reports-print-heading{display:block!important;margin:0 0 8mm!important}
 body.reports-printing #reports .reports-print-heading h1{font-size:20pt!important;margin:0 0 2mm!important}
 body.reports-printing #reports .reports-print-heading h2{font-size:14pt!important;margin:0 0 2mm!important}
 body.reports-printing #reports .reports-panel{display:none!important}
 body.reports-printing[data-reports-print="${report}"] #reports [data-report-panel="${report}"]{display:block!important}
 body.reports-printing #reports .reports-panel-heading{margin:0 0 4mm!important}
 body.reports-printing #reports .records-table-wrap{overflow:visible!important}
 body.reports-printing #reports .records-table{width:100%!important;min-width:0!important;border-collapse:collapse!important}
 body.reports-printing #reports .records-table th,body.reports-printing #reports .records-table td{font-size:9pt!important;padding:2mm!important;border:1px solid #777!important;color:#111!important;white-space:normal!important}
 body.reports-printing #reports .records-table th{background:#eee!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 body.reports-printing #reports .census-stat{box-shadow:none!important;border:1px solid #888!important}
 body.reports-printing #reports .census-note{font-size:8pt!important}
 }`;
 document.head.appendChild(style);
 const cleanup=()=>{document.body.classList.remove("reports-printing");delete document.body.dataset.reportsPrint;style.remove()};
 window.addEventListener("afterprint",cleanup,{once:true});
 window.print();setTimeout(()=>{if(document.body.classList.contains("reports-printing"))cleanup()},120000);
}));
