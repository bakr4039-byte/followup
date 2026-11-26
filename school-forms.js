/* school-forms.js — the school's official forms (النماذج الرسمية) as fillable records with official printing.
   Each form keeps its official name, code, fields, table columns and signature boxes.
   The manager sees every form and assigns form groups to employees (formAccess/{uid});
   an employee sees only the groups assigned to them. Records are saved in formRecords and lock when finalised. */
(function(root){'use strict';
if(!root.document||root.TeacherPortal)return;
if(new URLSearchParams(root.location.search).get('embedded')==='1')return;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
const KIND=['مستهلك','مستديم'];
const ROLES={deputy:'الوكالة (الشؤون المدرسية والطلابية)',exams:'الاختبارات',lab:'المختبر والمستودع',lrc:'مصادر التعلم',activity:'النشاط الطلابي'};
const ROLE_HINTS={deputy:/وكيل/,exams:/وكيل الشؤون التعليمية|اختبار/,lab:/مختبر|مستودع/,lrc:/مصادر التعلم/,activity:/النشاط/};
const YEAR={key:'year',label:'العام الدراسي',def:'year'};
const TERM={key:'term',label:'الفصل الدراسي',type:'select',options:['الأول','الثاني','الثالث']};
const NO={key:'no',label:'رقم الصنف'},NAME={key:'name',label:'اسم الصنف'},UNIT={key:'unit',label:'الوحدة'},QTY={key:'qty',label:'الكمية',type:'number'},NOTES={key:'notes',label:'ملاحظات'};
const LAB_SIGNS=['محضر المختبر','وكيل الشؤون المدرسية'],LRC_SIGNS=['أمين مركز مصادر التعلم'];
const FORMS=[
  {code:'و.م.ع.ن-06-01',owner:'lab',title:'كشف بموجودات المستودع العام للمدرسة',landscape:true,
    sections:[{key:'items',columns:[NO,{key:'desc',label:'أوصافه'},{key:'state',label:'الحالة',type:'select',options:['سليم','تالف']},QTY,{key:'kind',label:'نوعه',type:'select',options:KIND},{key:'date',label:'التاريخ',type:'date'},{key:'notes',label:'ملحوظات'}]}],
    signatures:['المسؤول عن المستودع','وكيل الشؤون المدرسية']},
  {code:'و.م.ع.ن-06-02',owner:'lab',title:'سجل استلام عهدة',landscape:true,header:[{key:'person',label:'الاسم'},{key:'job',label:'الوظيفة'}],
    statement:'أنا الموقّع أدناه استلمت العهدة المجدولة من تاريخه، وأتعهد بالمحافظة عليها من الفقدان والتلف.',
    sections:[{key:'items',columns:[{key:'item',label:'الصنف'},{key:'count',label:'العدد',type:'number'},{key:'received',label:'تاريخ الاستلام',type:'date'},{key:'sign1',label:'التوقيع',type:'blank'},{key:'returned',label:'تاريخ إعادة العهدة',type:'date'},{key:'sign2',label:'توقيع مستلم العهدة المسترجعة',type:'blank'},{key:'notes',label:'ملحوظات'}]}],
    signatures:['المستلم','وكيل الشؤون المدرسية']},
  {code:'و.م.ع.ن-06-03',owner:'lab',title:'محضر فقد أو إتلاف مواد',landscape:true,header:[{key:'day',label:'اليوم',type:'select',options:DAYS},{key:'date',label:'التاريخ',type:'date'}],
    sections:[{key:'items',columns:[NO,{key:'name',label:'اسم الصنف ومواصفاته'},{key:'kind',label:'نوعه',type:'select',options:KIND},UNIT,QTY,{key:'reason',label:'أسباب الفقد / التلف'},{key:'notes',label:'ملحوظات'}]}],
    signatures:['المساعد الإداري','وكيل الشؤون المدرسية','مدير المدرسة']},
  {code:'و.م.ع.ن-08-01',owner:'lab',title:'سجل جرد المختبر والمواد الكيميائية',header:[{key:'cabinet',label:'رقم خزانة المواد الكيميائية'}],
    sections:[{key:'lab',title:'أولًا: جرد المختبر',columns:[NO,NAME,UNIT,QTY,NOTES]},{key:'chem',title:'ثانيًا: بيان بعهدة خزانة المواد الكيميائية',columns:[NO,NAME,UNIT,QTY,NOTES]}],signatures:LAB_SIGNS},
  {code:'و.م.ع.ن-08-02',owner:'lab',title:'سجل حصر الناقص والزائد والتالف في المختبر',header:[YEAR,TERM],
    sections:[{key:'short',title:'أسماء المواد والأدوات الناقصة',columns:[NO,NAME,{key:'qty',label:'الكمية المطلوبة',type:'number'},NOTES]},
      {key:'extra',title:'أسماء المواد والأدوات الزائدة',columns:[NO,NAME,{key:'qty',label:'الكمية والوحدة'},{key:'state',label:'حالة الصنف'},NOTES]},
      {key:'damaged',title:'أسماء المواد والأدوات التالفة',columns:[NO,NAME,QTY,NOTES]}],signatures:LAB_SIGNS},
  {code:'و.م.ع.ن-08-03',owner:'lab',title:'الخطة الفصلية للتجارب العلمية',landscape:true,header:[YEAR,TERM],
    sections:[{key:'plan',columns:[{key:'cls',label:'الفصل'},{key:'subject',label:'المادة'},{key:'exp',label:'اسم التجربة'},{key:'book',label:'اسم الكتاب ورقم الصفحة'},{key:'week',label:'أسبوع التجربة'},{key:'tools',label:'أدوات التجربة'},{key:'teacher',label:'معلم المادة'}]}],signatures:LAB_SIGNS},
  {code:'و.م.ع.ن-08-04',owner:'lab',title:'سجل تنفيذ التجارب العلمية',landscape:true,
    sections:[{key:'runs',columns:[{key:'subject',label:'المادة'},{key:'cls',label:'الفصل'},{key:'exp',label:'اسم التجربة'},{key:'teacher',label:'اسم المعلم'},{key:'week',label:'أسبوع التجربة'},{key:'date',label:'تاريخ الإجراء',type:'date'},
      {key:'place',label:'التنفيذ',type:'select',options:['نُفّذ في المختبر','نُفّذ في الفصل','نُفّذ في مكان آخر','لم يُنفّذ']},{key:'why',label:'سبب عدم التنفيذ',type:'select',options:['','لعدم توفر المواد','عدم تجهيز المحضر للأدوات','عدم قيام المعلم بالتجربة','أسباب أخرى']},{key:'sign',label:'توقيع المعلم',type:'blank'}]}],signatures:LAB_SIGNS},
  {code:'و.م.ع.ن-08-05',owner:'lab',title:'جرد المعامل',landscape:true,
    sections:[{key:'items',columns:[NO,NAME,UNIT,{key:'listed',label:'المقيد بالعهدة',type:'number'},{key:'ok',label:'صالح',type:'number'},{key:'bad',label:'غير صالح',type:'number'},{key:'extra',label:'الزيادة',type:'number'}]}],signatures:LAB_SIGNS},
  {code:'و.م.ع.ن-07-01',owner:'lrc',title:'سجل استعارة كتب للطلاب',landscape:true,header:[YEAR,TERM],
    sections:[{key:'loans',columns:[{key:'book',label:'عنوان الكتاب'},{key:'author',label:'اسم المؤلف'},{key:'out',label:'تاريخ الاستعارة',type:'date'},{key:'student',label:'اسم الطالب'},{key:'cls',label:'الصف'},{key:'sign',label:'التوقيع',type:'blank'},{key:'back',label:'تاريخ الإعادة',type:'date'},{key:'sign2',label:'توقيع أمين المركز',type:'blank'}]}],signatures:LRC_SIGNS},
  {code:'و.م.ع.ن-07-02',owner:'lrc',title:'سجل استعارة كتب للموظفين',landscape:true,
    sections:[{key:'loans',columns:[{key:'book',label:'عنوان الكتاب'},{key:'author',label:'اسم المؤلف'},{key:'out',label:'تاريخ الاستعارة',type:'date'},{key:'employee',label:'اسم الموظف'},{key:'sign',label:'التوقيع',type:'blank'},{key:'back',label:'تاريخ الإعادة',type:'date'},{key:'sign2',label:'توقيع أمين المركز',type:'blank'}]}],signatures:LRC_SIGNS},
  {code:'و.م.ع.ن-07-03',owner:'lrc',title:'سجل زيارات الفصول',landscape:true,layout:'weekGrid',header:[YEAR,TERM,{key:'from',label:'الأسبوع من',type:'date'},{key:'to',label:'إلى',type:'date'}],
    sections:[{key:'visits',columns:[{key:'day',label:'اليوم',type:'select',options:DAYS},{key:'period',label:'الحصة',type:'select',options:['1','2','3','4','5','6']},{key:'subject',label:'المادة'},{key:'cls',label:'الصف'},{key:'teacher',label:'اسم المعلم'}]}],signatures:LRC_SIGNS},
  {code:'و.م.ع.ن-07-04',owner:'lrc',title:'سجل التردد اليومي',landscape:true,header:[YEAR,TERM],
    sections:[{key:'visits',columns:[{key:'date',label:'اليوم والتاريخ',type:'date'},{key:'student',label:'اسم الطالب'},{key:'cls',label:'الصف'},{key:'time',label:'وقت الزيارة',type:'time'},{key:'purpose',label:'الغرض من الزيارة'},{key:'tools',label:'المواد والأجهزة المستخدمة'},{key:'sign',label:'توقيع الطالب',type:'blank'}]}],signatures:LRC_SIGNS},
  {code:'و.ط.ع.ن-05-01',owner:'activity',title:'سجل حضور الطلاب لمجالات النشاط',landscape:true,
    header:[YEAR,TERM,{key:'field',label:'اسم المجال'},{key:'lead',label:'مسؤول النشاط'},{key:'place',label:'المقر'},{key:'from',label:'الأسبوع من',type:'date'},{key:'to',label:'إلى',type:'date'}],
    sections:[{key:'students',columns:[{key:'student',label:'اسم الطالب'},{key:'cls',label:'الصف'}].concat(DAYS.map((d,i)=>({key:'d'+i,label:d,type:'select',options:['','ح','غ']})),[{key:'notes',label:'ملحوظات'}])}],
    signatures:['مسؤول النشاط','رائد النشاط']},
  {code:'و.ط.ع.ن-05-02',owner:'activity',title:'موافقة ولي أمر الطالب لمشاركة ابنه في نشاط مدرسي',layout:'letter',
    header:[YEAR,TERM,{key:'type',label:'نوع النشاط',type:'select',options:['رحلة','زيارة','مشاركة','أخرى']},{key:'other',label:'تفاصيل النشاط'},{key:'place',label:'المكان'},{key:'lead',label:'مشرف الرحلة'},{key:'leadPhone',label:'رقم جوال المشرف'},
      {key:'day',label:'اليوم',type:'select',options:DAYS},{key:'date',label:'التاريخ',type:'date'},{key:'start',label:'ساعة الانطلاق',type:'time'},{key:'end',label:'ساعة العودة',type:'time'}],
    sections:[{key:'students',title:'الطلاب المرشّحون (يُطبع خطاب لكل طالب)',columns:[{key:'student',label:'اسم الطالب'},{key:'cls',label:'الصف'}]}],signatures:false},
  {code:'و.ت.ع.ن-01-02أ',owner:'deputy',title:'جدول المناوبة والإشراف اليومي',landscape:true,header:[YEAR,TERM],
    statement:'لا يُشترط أن يُكلّف الموظف بالمناوبة والإشراف في يوم واحد، ولا يقل الحد الأدنى للمناوبة والإشراف عن موظفين ويمكن زيادة العدد حسب الاحتياج.',
    sections:[{key:'days',columns:[{key:'week',label:'الأسبوع'},{key:'day',label:'اليوم',type:'select',options:DAYS},{key:'date',label:'التاريخ',type:'date'},{key:'duty',label:'المناوبة (الاسم)'},{key:'dutySign',label:'التوقيع',type:'blank'},{key:'sup',label:'الإشراف (الاسم)'},{key:'supSign',label:'التوقيع',type:'blank'},{key:'notes',label:'ملاحظات'}]}],
    signatures:['وكيل الشؤون التعليمية','مدير المدرسة']},
  {code:'و.ت.ع.ن-01-03',owner:'deputy',title:'تقرير المناوبة اليومي',header:[YEAR,TERM,{key:'day',label:'اليوم',type:'select',options:DAYS},{key:'date',label:'التاريخ',type:'date'}],
    statement:'يتم تسليم هذا التقرير إلى وكيل الشؤون التعليمية في اليوم التالي للمناوبة.',
    sections:[{key:'staff',title:'الموظفون المناوبون',columns:[{key:'name',label:'اسم الموظف المناوب'},{key:'sign',label:'التوقيع',type:'blank'},{key:'notes',label:'ملحوظات'}]},
      {key:'late',title:'أسماء الطلاب المتأخرين',columns:[{key:'name',label:'الاسم'},{key:'cls',label:'الفصل'},{key:'time',label:'الزمن',type:'time'},{key:'action',label:'الإجراء المتخذ'},{key:'notes',label:'ملحوظات'}]},
      {key:'violations',title:'أسماء الطلاب المخالفين',columns:[{key:'name',label:'الاسم'},{key:'cls',label:'الفصل'},{key:'time',label:'الزمن',type:'time'},{key:'action',label:'الإجراء المتخذ'},{key:'notes',label:'ملحوظات'}]}],
    signatures:['المناوب','وكيل الشؤون التعليمية']},
  {code:'و.م.ع.ن-02-04',owner:'deputy',title:'مساءلة غياب',link:'vAcc',linkLabel:'قسم المساءلات',sections:[]},
  {code:'و.م.ع.ن-02-06',owner:'deputy',title:'سجل استئذان الموظفين',landscape:true,
    header:[{key:'person',label:'الاسم'},{key:'civil',label:'السجل المدني'},{key:'major',label:'التخصص'},{key:'level',label:'المستوى / المرتبة'},{key:'grade',label:'الدرجة'},{key:'jobNo',label:'رقم الوظيفة'},{key:'work',label:'العمل الحالي'}],
    sections:[{key:'exits',columns:[{key:'day',label:'اليوم',type:'select',options:DAYS},{key:'date',label:'التاريخ',type:'date'},{key:'out',label:'زمن الخروج',type:'time'},{key:'sign1',label:'التوقيع',type:'blank'},{key:'reason',label:'مبررات الخروج'},{key:'back',label:'زمن العودة',type:'time'},{key:'sign2',label:'التوقيع',type:'blank'},{key:'notes',label:'ملاحظات'}]}],
    signatures:['الموظف','الرئيس المباشر']},
  {code:'و.ط.ع.ن-03-01',owner:'deputy',title:'سجل بأسماء الطلاب المتأخرين صباحًا',header:[{key:'day',label:'اليوم',type:'select',options:DAYS},{key:'date',label:'التاريخ',type:'date'}],
    sections:[{key:'late',columns:[{key:'student',label:'اسم الطالب'},{key:'cls',label:'الصف والشعبة'},{key:'minutes',label:'مقدار التأخر (دقيقة)',type:'number'},{key:'reason',label:'أسباب التأخر'},{key:'sign',label:'توقيع الطالب',type:'blank'}]}],
    signatures:['المسؤول']},
  {code:'و.ط.ع.ن-03-04',owner:'deputy',title:'سجل استئذان الطلاب أثناء الدوام الرسمي',landscape:true,
    statement:'لا بد من حضور ولي الأمر في حال خروج الطالب أثناء الدوام الرسمي، خلاف ذلك يُمنع خروج الطالب من المدرسة حسب لوائح وزارة التعليم.',
    sections:[{key:'exits',columns:[{key:'student',label:'اسم الطالب'},{key:'cls',label:'الفصل'},{key:'date',label:'التاريخ',type:'date'},{key:'out',label:'وقت الخروج',type:'time'},{key:'reason',label:'سبب الاستئذان'},{key:'guardian',label:'اسم ولي الأمر'},{key:'sign',label:'التوقيع',type:'blank'}]}],
    signatures:['وكيل شؤون الطلاب']},
  {code:'و.م.ع.ن-04-01',owner:'deputy',title:'استمارة موافقة ولي أمر الطالب للاشتراك في النقل المدرسي',header:[YEAR],
    letter:(h,st)=>'<p>المكرم ولي أمر الطالب: <b>'+esc(st.student||'....................')+'</b> '+(st.cls?'(الصف: '+esc(st.cls)+')':'')+' المحترم</p><p>السلام عليكم ورحمة الله وبركاته، وبعد:</p>'+
      '<p>تقوم المدرسة بتسجيل الطلاب الراغبين في الاشتراك في النقل المدرسي، وعليه نأمل موافاتنا بموافقتكم أو عدمها ليتسنّى لنا إجراء اللازم.</p>'+
      '<p>☐ موافق    ☐ غير موافق</p><p><b>اسم ولي الأمر:</b> ................................ <b>التوقيع:</b> ....................</p><p><b>هاتف المنزل:</b> .................... <b>الجوال:</b> ....................</p>'+
      '<p style="text-align:left"><b>مدير المدرسة</b><br>حسن بن محمد العمري</p>',
    sections:[{key:'students',title:'الطلاب (يُطبع خطاب لكل طالب)',columns:[{key:'student',label:'اسم الطالب'},{key:'cls',label:'الصف'}]}],signatures:false},
  {code:'و.ط.ع.ن-04-03',owner:'deputy',title:'تحويل طالب لوكيل شؤون الطلاب',
    header:[{key:'student',label:'اسم الطالب'},{key:'cls',label:'الصف'},{key:'subject',label:'المادة'},{key:'period',label:'الحصة الدراسية'},{key:'date',label:'التاريخ',type:'date'},
      {key:'reason',label:'سبب التحويل',type:'select',options:['عدم أداء الواجب','مشاغبة','تأخر عن الحصة','ضعف دراسي','أخرى']},{key:'other',label:'أخرى (تُذكر)'},{key:'problem',label:'إيضاح المشكلة',type:'long'},{key:'action',label:'الإجراء المتخذ',type:'long'}],
    sections:[],signatures:['المعلم','وكيل شؤون الطلاب']},
  {code:'و.ط.ع.ن-03-30',owner:'deputy',title:'كشف حضور وغياب طلاب المدرسة',link:'vStudentAttendance',linkLabel:'سجل حضور الطلاب',sections:[]},
  {code:'و.م.ع.ن-03-01',owner:'deputy',title:'طلب صيانة',
    header:[YEAR,TERM,{key:'type',label:'نوع الصيانة المطلوبة',type:'select',options:['كهرباء','نجارة','سباكة','تبريد','تكييف','صيانة (كراسي وطاولات)','أخرى']},{key:'other',label:'أخرى تُذكر'},
      {key:'urgency',label:'نوع الطلب',type:'select',options:['عاجل','عاجل جدًا']},{key:'when',label:'متى يمكن إجراء الصيانة',type:'select',options:['في الصباح فقط','في الصباح أو المساء']}],
    statement:'اسم المدرسة: ثانوية الصحافة الأهلية · المرحلة: الثانوية. ملحوظة: عند اختيار الصيانة في وقت الصباح فقط قد يؤخر ذلك إجراء الصيانة.',
    sections:[{key:'works',title:'آمل تكليف فريق الصيانة بعمل ما يلي',columns:[{key:'work',label:'العمل المطلوب'},{key:'place',label:'الموقع'}]}],
    signatures:['وكيل الشؤون المدرسية','مدير المدرسة']},
  {code:'و.ت.ع.ن-05-01',owner:'exams',title:'مهام لجان الاختبار الفرعية',header:[YEAR,{key:'round',label:'الدور',type:'select',options:['الأول','الثاني']},TERM],
    sections:[{key:'control',title:'لجنة التحكيم والضبط',columns:[{key:'name',label:'الاسم'},{key:'role',label:'الصفة',type:'select',options:['رئيس','عضو']},{key:'task',label:'المهمة'},{key:'sign',label:'التوقيع',type:'blank'}]},{key:'supervision',title:'لجنة الإشراف والملاحظة',columns:[{key:'name',label:'الاسم'},{key:'role',label:'الصفة',type:'select',options:['رئيس','عضو']},{key:'task',label:'المهمة'},{key:'sign',label:'التوقيع',type:'blank'}]},{key:'correction',title:'لجنة التصحيح والمراجعة',columns:[{key:'name',label:'الاسم'},{key:'role',label:'الصفة',type:'select',options:['رئيس','عضو']},{key:'task',label:'المهمة'},{key:'sign',label:'التوقيع',type:'blank'}]},{key:'results',title:'لجنة الرصد وإخراج النتائج',columns:[{key:'name',label:'الاسم'},{key:'role',label:'الصفة',type:'select',options:['رئيس','عضو']},{key:'task',label:'المهمة'},{key:'sign',label:'التوقيع',type:'blank'}]}],
    signatures:['مدير المدرسة']},
  {code:'و.ت.ع.ن-05-02',owner:'exams',title:'محضر فتح مظروف أسئلة',
    header:[{key:'day',label:'اليوم',type:'select',options:DAYS},{key:'date',label:'التاريخ',type:'date'},{key:'session',label:'الفترة'},{key:'subject',label:'المادة'},{key:'grade',label:'الصف'},{key:'round',label:'الدور',type:'select',options:['الأول','الثاني']},TERM,{key:'time',label:'تم فتح المظروف عند الساعة',type:'time'},{key:'found',label:'ووُجد',type:'long'}],
    statement:'وتم تحرير محضر بذلك.',
    sections:[{key:'members',title:'أعضاء اللجنة',columns:[{key:'name',label:'أعضاء اللجنة'},{key:'role',label:'الصفة',type:'select',options:['رئيس','عضو']},{key:'sign',label:'التوقيع',type:'blank'}]}],signatures:['مدير المدرسة']},
  {code:'و.ت.ع.ن-05-03',owner:'exams',title:'محضر مخالفة الأنظمة والتعليمات',
    header:[YEAR,TERM,{key:'subject',label:'المادة'},{key:'day',label:'اليوم',type:'select',options:DAYS},{key:'date',label:'التاريخ',type:'date'},{key:'session',label:'الفترة'},
      {key:'student',label:'اسم الطالب'},{key:'seat',label:'رقم الجلوس'},{key:'cls',label:'الصف / الفصل'},{key:'repeat',label:'تكرار المخالفة',type:'select',options:['المرة الأولى','المرة الثانية','المرة الثالثة']},{key:'kind',label:'نوع المخالفة',type:'select',options:['فردي','جماعي']},{key:'desc',label:'وصف المخالفة',type:'long'},{key:'decision',label:'الإجراء / القرار',type:'long'}],
    sections:[],signatures:['الطالب','الملاحظ','رئيس اللجنة','مدير المدرسة']},
  {code:'و.ت.ع.ن-05-04',owner:'exams',title:'كشف الغياب اليومي للطلاب في الاختبارات',landscape:true,
    header:[{key:'day',label:'اليوم',type:'select',options:DAYS},{key:'date',label:'التاريخ',type:'date'},YEAR,TERM,{key:'round',label:'الدور',type:'select',options:['الأول','الثاني']},{key:'registered',label:'عدد المسجلين',type:'number'},{key:'absent',label:'عدد الغائبين',type:'number'}],
    sections:[{key:'absent',columns:[{key:'cls',label:'الصف'},{key:'student',label:'اسم الطالب'},{key:'seat',label:'رقم الجلوس'},{key:'session',label:'الفترة'},{key:'subject',label:'المادة'},{key:'notes',label:'ملاحظات'}]}],signatures:['رئيس لجنة التحكيم والضبط','مدير المدرسة']},
  {code:'و.ت.ع.ن-05-05',owner:'exams',title:'كشف تسليم أوراق الإجابة',landscape:true,
    header:[{key:'week',label:'الأسبوع'},{key:'from',label:'من',type:'date'},{key:'to',label:'إلى',type:'date'}],
    sections:[{key:'delivery',columns:[{key:'name',label:'اسم الملاحظ'},{key:'day',label:'اليوم',type:'select',options:DAYS},{key:'subject1',label:'مادة 1'},{key:'sign1',label:'التوقيع',type:'blank'},{key:'subject2',label:'مادة 2'},{key:'sign2',label:'التوقيع',type:'blank'}]}],signatures:['رئيس لجنة التحكيم والضبط']},
  {code:'و.ت.ع.ن-05-06',owner:'exams',title:'بيان تسليم واستلام أوراق إجابات اختبار',landscape:true,header:[TERM,YEAR,{key:'grade',label:'للصف'}],
    sections:[{key:'sheets',columns:[{key:'date',label:'اليوم والتاريخ',type:'date'},{key:'subject',label:'المادة'},{key:'room',label:'رقم اللجنة'},{key:'present',label:'عدد الحضور',type:'number'},{key:'absent',label:'عدد الغياب',type:'number'},{key:'total',label:'المجموع',type:'number'},{key:'papers',label:'عدد أوراق الإجابة',type:'number'},
      {key:'r1',label:'التحكيم والضبط (استلام) — اسم المستلم'},{key:'r2',label:'التصحيح والمراجعة — اسم المستلم'},{key:'r3',label:'الرصد وإخراج النتائج — اسم المستلم'},{key:'r4',label:'التحكيم والضبط (حفظ) — اسم المستلم'},{key:'notes',label:'ملاحظات'}]}],
    statement:'يوقّع كل مستلم أمام اسمه عند التسليم والاستلام.',signatures:['رئيس لجنة التحكيم والضبط','مدير المدرسة']},
  {code:'و.ت.ع.ن-05-07',owner:'exams',title:'تعديل درجة',landscape:true,
    header:[{key:'person',label:'اسم مقدّم الطلب'},{key:'date',label:'التاريخ',type:'date'},{key:'decision',label:'رأي مدير المدرسة',type:'select',options:['الموافقة','عدم الموافقة']}],
    statement:'المكرم مدير المدرسة، السلام عليكم ورحمة الله وبركاته. آمل التكرم بتعديل الدرجة / الدرجات للطلاب التالية أسماؤهم، مع جزيل الشكر.',
    sections:[{key:'grades',columns:[{key:'subject',label:'المادة'},{key:'student',label:'اسم الطالب'},{key:'cls',label:'الصف'},{key:'before',label:'الدرجة قبل التعديل'},{key:'after',label:'الدرجة بعد التعديل'},{key:'reason',label:'سبب التعديل'},{key:'registrar',label:'مسجّل المعلومات'},{key:'changed',label:'تاريخ التعديل',type:'date'},{key:'sign',label:'التوقيع',type:'blank'}]}],
    signatures:['مقدّم الطلب','مسجّل المعلومات','مدير المدرسة']}
];
const byCode=new Map(FORMS.map(f=>[f.code,f]));
const signedIn=()=>!!(root.firebase&&firebase.apps.length&&firebase.auth().currentUser);
const managerMode=()=>!!(root.__FUACC&&root.__FUACC.state&&root.__FUACC.state.role===-1&&signedIn());
const employeeMode=()=>!!(root.EmployeePortal&&signedIn()&&$('account')&&!$('account').hidden);
const fs=()=>firebase.firestore();
const today=()=>{const p=new Intl.DateTimeFormat('en',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');};
const hijriYear=()=>{try{const p=new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn',{year:'numeric'}).formatToParts(new Date());const y=Number((p.find(x=>x.type==='year')||{}).value);return y?(y-1)+'/'+y+' هـ':'';}catch(e){return '';}};
const hijri=d=>{if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d||''))return d||'';try{return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn',{day:'numeric',month:'numeric',year:'numeric'}).format(new Date(d+'T12:00:00Z'));}catch(e){return d;}};
const shown=(col,v)=>col.type==='date'?hijri(v):(v==null?'':String(v));
const message=err=>err&&err.code==='permission-denied'?'حسابك لا يملك صلاحية هذا الإجراء.':(err&&err.message)||'تعذّر إكمال العملية.';
let host=null,mode='',actor='',roles=[],view='home',form=null,records=[],record=null,busy=false;
const status=t=>{const s=$('fmStatus');if(s)s.textContent=t;};
function ensure(){
  const want=managerMode()?'manager':employeeMode()?'employee':'';
  if(want==='manager'){
    const ws=$('schoolWorkspace');if(!ws)return null;
    if(!host||!host.isConnected||mode!=='manager'){host&&host.remove();host=build('school-workspace-section');host.id='schoolSection-forms';ws.append(host);mode='manager';}
    const links=document.querySelector('.school-sidebar-links');
    if(links&&!$('schoolFormsLink')){const b=document.createElement('button');b.type='button';b.id='schoolFormsLink';b.className='school-home-link';b.dataset.workspaceKey='forms';b.textContent='النماذج الرسمية';
      const after=$('schoolSupervisionLink')||$('schoolProfilesLink')||$('schoolHomeLink');if(after&&after.parentNode===links)after.after(b);else links.prepend(b);}
  }else if(want==='employee'){
    if(!host||!host.isConnected||mode!=='employee'){host&&host.remove();host=build('card');host.id='formsCenter';$('account').append(host);mode='employee';}
  }else{if(host){host.hidden=true;}const b=$('schoolFormsLink');if(b)b.hidden=true;return null;}
  const b=$('schoolFormsLink');if(b)b.hidden=mode!=='manager';
  return host;
}
function build(cls){
  const el=document.createElement('section');el.className=cls+' fm-page';el.hidden=true;el.setAttribute('aria-label','النماذج الرسمية');
  el.innerHTML='<div class="fm-head"><h2>النماذج الرسمية</h2><p>نماذج المدرسة بأسمائها ورموزها الرسمية: تعبئة وحفظ وطباعة بخانات التوقيع.</p></div><p id="fmStatus" role="status"></p><div id="fmBody"></div>';
  el.addEventListener('click',onClick);
  return el;
}
async function tick(){
  const h=ensure();if(!h)return;
  const now=firebase.auth().currentUser.uid+'|'+mode;
  if(now!==actor){actor=now;roles=[];view='home';form=null;record=null;$('fmBody').innerHTML='';status('');
    if(mode==='manager'){roles=Object.keys(ROLES);paint();}
    else{try{const snap=await fs().doc('formAccess/'+firebase.auth().currentUser.uid).get();if(now!==actor)return;roles=((snap.data()||{}).roles||[]).filter(r=>ROLES[r]);}catch(e){roles=[];}paint();}
  }
  const show=mode==='manager'||roles.length>0;
  if(h.hidden===show)h.hidden=!show;
}
function paint(){
  const body=$('fmBody');if(!body)return;
  if(view==='home')body.innerHTML=homeView();
  else if(view==='form')body.innerHTML=formView();
  else if(view==='record')body.innerHTML=recordView();
}
function homeView(){
  const groups=roles.map(r=>'<section class="fm-group"><h3>'+esc(ROLES[r])+'</h3><div class="fm-list">'+FORMS.filter(f=>f.owner===r).map(f=>'<button type="button" class="fm-card" '+(f.link?'data-fm-link':'data-fm-open')+'="'+esc(f.code)+'"><b>'+esc(f.title)+'</b><small>رمز النموذج: '+esc(f.code)+'</small></button>').join('')+'</div></section>').join('');
  return (mode==='manager'?'<div class="fm-bar"><button type="button" data-fm-access>صلاحيات الموظفين على النماذج</button></div><div id="fmAccess"></div>':'')+(groups||'<p class="fm-hint">لا توجد نماذج مخصصة لك.</p>');
}
function formView(){
  const rows=records.map(r=>'<tr><td>'+esc(recordLabel(r))+'</td><td>'+esc(r.updatedAt&&r.updatedAt.toDate?hijri(r.updatedAt.toDate().toISOString().slice(0,10)):'')+'</td><td>'+(r.rows||[]).length+'</td><td><span class="fm-state fm-'+esc(r.status)+'">'+(r.status==='final'?'معتمد':'مسودة')+'</span></td><td><button type="button" data-fm-record="'+esc(r.id)+'">فتح</button></td></tr>').join('');
  return '<button type="button" class="fm-back" data-fm-home>→ كل النماذج</button><div class="fm-bar"><div><h3>'+esc(form.title)+'</h3><small>رمز النموذج: '+esc(form.code)+'</small></div><button type="button" class="fm-primary" data-fm-new>سجل جديد</button></div>'+
    (rows?'<div class="fm-grid"><table><thead><tr><th>السجل</th><th>آخر تحديث</th><th>الصفوف</th><th>الحالة</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="fm-hint">لا توجد سجلات لهذا النموذج بعد.</p>');
}
const recordLabel=r=>{const h=r.header||{};return [h.year,h.term&&('الفصل '+h.term),h.person,h.student,h.subject,h.field,h.date&&hijri(h.date),h.from&&('من '+hijri(h.from))].filter(Boolean).join(' · ')||'سجل';};
function input(col,value,name,locked){
  const v=value==null?'':String(value),dis=locked?' disabled':'';
  if(col.type==='blank')return '<span class="fm-blank">تُوقّع بعد الطباعة</span>';
  if(col.type==='long')return '<textarea name="'+name+'" rows="3" maxlength="1200"'+dis+'>'+esc(v)+'</textarea>';
  if(col.type==='select')return '<select name="'+name+'"'+dis+'>'+(col.options.includes('')?'':'<option value=""></option>')+col.options.map(o=>'<option'+(o===v?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>';
  const type=col.type==='number'?'number':col.type==='date'?'date':col.type==='time'?'time':'text';
  return '<input type="'+type+'" name="'+name+'" value="'+esc(v)+'" maxlength="300"'+dis+'>';
}
function recordView(){
  const f=form,r=record,locked=r.status==='final';
  const header=(f.header||[]).map(c=>'<label>'+esc(c.label)+input(c,r.header[c.key],'h:'+c.key,locked)+'</label>').join('');
  const sections=f.sections.map(s=>{
    const rows=r.rows.map((row,i)=>({row,i})).filter(x=>x.row.s===s.key);
    const cols=s.columns;
    return '<section class="fm-sec">'+(s.title?'<h4>'+esc(s.title)+'</h4>':'')+'<div class="fm-grid"><table><thead><tr><th>م</th>'+cols.map(c=>'<th>'+esc(c.label)+'</th>').join('')+(locked?'':'<th></th>')+'</tr></thead><tbody>'+
      rows.map((x,n)=>'<tr><td>'+(n+1)+'</td>'+cols.map(c=>'<td>'+input(c,x.row[c.key],'r:'+x.i+':'+c.key,locked)+'</td>').join('')+(locked?'':'<td><button type="button" data-fm-del="'+x.i+'" aria-label="حذف الصف">✕</button></td>')+'</tr>').join('')+
      '</tbody></table></div>'+(locked?'':'<button type="button" data-fm-add="'+esc(s.key)+'">+ إضافة صف</button>')+'</section>';
  }).join('');
  return '<button type="button" class="fm-back" data-fm-back>→ سجلات النموذج</button><div class="fm-bar"><div><h3>'+esc(f.title)+'</h3><small>رمز النموذج: '+esc(f.code)+(locked?' · معتمد ولا يُعدَّل':'')+'</small></div></div>'+
    '<form id="fmForm" class="fm-form">'+(header?'<div class="fm-fields">'+header+'</div>':'')+(f.statement?'<p class="fm-statement">'+esc(f.statement)+'</p>':'')+sections+'</form>'+
    '<div class="fm-actions">'+(locked?'':'<button type="button" class="fm-primary" data-fm-save>حفظ</button><button type="button" data-fm-final>اعتماد وإغلاق</button>')+'<button type="button" data-fm-print>طباعة / PDF</button></div>';
}
function collect(){
  const f=$('fmForm');if(!f||!record||record.status==='final')return;
  for(const el of f.elements){
    if(!el.name)continue;
    const parts=el.name.split(':');
    if(parts[0]==='h')record.header[parts[1]]=el.value.trim().slice(0,1200);
    else if(parts[0]==='r'&&record.rows[Number(parts[1])])record.rows[Number(parts[1])][parts[2]]=el.value.trim().slice(0,300);
  }
}
async function openForm(code){
  form=byCode.get(code);if(!form)return;
  view='form';records=[];paint();status('جارٍ التحميل…');
  try{
    const snap=await fs().collection('formRecords').where('owner','==',form.owner).where('formCode','==',form.code).get();
    if(form&&form.code===code){records=snap.docs.map(d=>Object.assign({id:d.id},d.data())).sort((a,b)=>((b.updatedAt&&b.updatedAt.seconds)||0)-((a.updatedAt&&a.updatedAt.seconds)||0));status('');paint();}
  }catch(err){status(message(err));}
}
function newRecord(){
  const header={};for(const c of form.header||[])header[c.key]=c.def==='year'?hijriYear():'';
  record={id:'',revision:0,status:'draft',header,rows:[]};
  for(const s of form.sections)record.rows.push({s:s.key});
  view='record';paint();
}
async function save(final){
  if(busy||!record)return;
  collect();
  const rows=record.rows.filter(row=>Object.keys(row).some(k=>k!=='s'&&row[k]));
  if(rows.length>300){status('الحد الأقصى 300 صف في السجل الواحد. ابدأ سجلًا جديدًا.');return;}
  if(final&&root.UIKit&&!await root.UIKit.confirm('بعد الاعتماد لا يمكن تعديل هذا السجل. هل تريد الاعتماد؟'))return;
  busy=true;status('جارٍ الحفظ…');
  const db=fs(),me=firebase.auth().currentUser.uid,ts=firebase.firestore.FieldValue.serverTimestamp();
  const data={formCode:form.code,owner:form.owner,title:form.title,header:record.header,rows,status:final?'final':'draft',updatedBy:me,updatedAt:ts};
  try{
    if(!record.id){
      const ref=await db.collection('formRecords').add(Object.assign({},data,{revision:1,createdBy:me,createdAt:ts}));
      record.id=ref.id;record.revision=1;
    }else{
      const ref=db.collection('formRecords').doc(record.id),expected=record.revision;
      await db.runTransaction(async tx=>{const prev=await tx.get(ref);if(((prev.data()||{}).revision||0)!==expected)throw Error('تغيّر السجل من جلسة أخرى. أعد فتحه قبل الحفظ.');tx.update(ref,Object.assign({},data,{revision:expected+1}));});
      record.revision=expected+1;
    }
    record.rows=rows.length?rows:record.rows;record.status=data.status;
    const local=Object.assign({},record,{updatedAt:{seconds:Date.now()/1000,toDate:()=>new Date()}});
    records=[local].concat(records.filter(r=>r.id!==record.id));
    paint();status(final?'تم اعتماد السجل.':'تم الحفظ.');
  }catch(err){status(message(err));}
  finally{busy=false;}
}
function table(cols,rows,minRows){
  const list=rows.length?rows:Array.from({length:minRows},()=>({}));
  return '<table><thead><tr><th>م</th>'+cols.map(c=>'<th>'+esc(c.label)+'</th>').join('')+'</tr></thead><tbody>'+list.map((row,i)=>'<tr><td>'+(i+1)+'</td>'+cols.map(c=>'<td>'+(c.type==='blank'?'':esc(shown(c,row[c.key])))+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
}
function printRecord(){
  collect();
  const f=form,r=record,h=r.header||{};
  if(!root.ReportKit){status('أداة الطباعة غير متاحة.');return;}
  const fields=(f.header||[]).filter(c=>c.key!=='other'||h.type==='أخرى');
  let body='<p><b>رمز النموذج:</b> '+esc(f.code)+'</p>';
  if(f.letter){
    const list=r.rows.filter(x=>x.student);
    body=(list.length?list:[{}]).map(st=>'<div style="page-break-after:always"><p><b>رمز النموذج:</b> '+esc(f.code)+(h.year?' · العام الدراسي '+esc(h.year):'')+'</p>'+f.letter(h,st)+'</div>').join('');
  }else if(f.layout==='letter'){
    const students=r.rows.filter(x=>x.s==='students'&&x.student);
    const kind=h.type==='أخرى'?(h.other||'نشاط'):(h.type||'نشاط');
    body=(students.length?students:[{}]).map(st=>'<div style="page-break-after:always"><p><b>رمز النموذج:</b> '+esc(f.code)+' · العام الدراسي '+esc(h.year||'')+' · الفصل '+esc(h.term||'')+'</p>'+
      '<p>المكرم ولي أمر الطالب: <b>'+esc(st.student||'....................')+'</b> '+(st.cls?'(الصف: '+esc(st.cls)+')':'')+' حفظه الله</p><p>السلام عليكم ورحمة الله وبركاته، وبعد:</p>'+
      '<p>تعتزم المدرسة القيام بـ <b>'+esc(kind)+'</b> إلى <b>'+esc(h.place||'....................')+'</b>، بإشراف <b>'+esc(h.lead||'..........')+'</b> (جوال: '+esc(h.leadPhone||'..........')+')، وذلك يوم <b>'+esc(h.day||'..........')+'</b> الموافق <b>'+esc(hijri(h.date)||'....../....../......')+'</b> من الساعة <b>'+esc(h.start||'......')+'</b>، وستكون العودة بمشيئة الله في الساعة <b>'+esc(h.end||'......')+'</b>.</p>'+
      '<p>وقد تم ترشيح ابنكم ضمن الطلاب المشاركين في هذا النشاط، عليه نأمل موافاتنا بموافقتكم أو عدمها لتتسنّى لنا إجراء اللازم.</p>'+
      '<p style="text-align:left"><b>مدير المدرسة</b><br>حسن بن محمد العمري</p><hr>'+
      '<p><b>رأي ولي الأمر:</b> ☐ موافق    ☐ غير موافق</p><p><b>اسم ولي الأمر:</b> ................................   <b>التوقيع:</b> ....................</p>'+
      '<p><small>ملاحظة: يجب إعادة هذا الخطاب للمدرسة بعد اطلاع وتوقيع ولي الأمر.</small></p></div>').join('');
  }else{
    if(fields.length)body+='<table><tbody>'+fields.map(c=>'<tr><th>'+esc(c.label)+'</th><td>'+esc(shown(c,h[c.key]))+'</td></tr>').join('')+'</tbody></table>';
    if(f.statement)body+='<p><b>'+esc(f.statement)+'</b></p>';
    for(const s of f.sections){
      const rows=r.rows.filter(x=>x.s===s.key&&Object.keys(x).some(k=>k!=='s'&&x[k]));
      if(s.title)body+='<h3>'+esc(s.title)+'</h3>';
      if(f.layout==='weekGrid'){
        body+='<table><thead><tr><th>اليوم / الحصة</th>'+[1,2,3,4,5,6].map(p=>'<th>'+p+'</th>').join('')+'</tr></thead><tbody>'+
          DAYS.map(d=>'<tr><th>'+esc(d)+'</th>'+[1,2,3,4,5,6].map(p=>{const x=rows.find(v=>v.day===d&&String(v.period)===String(p));return '<td>'+(x?esc(x.subject||'')+'<br><small>'+esc(x.cls||'')+'<br>'+esc(x.teacher||'')+'</small>':'')+'</td>';}).join('')+'</tr>').join('')+'</tbody></table>';
      }else body+=table(s.columns,rows,8);
    }
  }
  const sub=(f.layout==='letter'||f.letter)?(h.year||''):[h.year,h.term&&('الفصل '+h.term)].filter(Boolean).join(' · ');
  if(!root.ReportKit.open({title:f.title,subtitle:sub||('رمز النموذج: '+f.code),body,landscape:!!f.landscape,signatures:f.signatures===false?false:f.signatures}))status('اسمح بفتح نافذة الطباعة ثم حاول مجددًا.');
}
async function accessView(){
  const box=$('fmAccess');if(!box||mode!=='manager')return;
  box.innerHTML='<p class="fm-hint">جارٍ تحميل الموظفين…</p>';
  try{
    const [emps,acc]=await Promise.all([fs().collection('employeeProfiles').get(),fs().collection('formAccess').get()]);
    const current=new Map(acc.docs.map(d=>[d.id,(d.data().roles||[])]));
    const list=emps.docs.map(d=>Object.assign({uid:d.id},d.data())).filter(e=>e.active===true).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar'));
    box.innerHTML='<div class="fm-grid"><table><thead><tr><th>الموظف</th><th>المسمى</th>'+Object.values(ROLES).map(l=>'<th>'+esc(l)+'</th>').join('')+'<th></th></tr></thead><tbody>'+
      list.map(e=>{const has=current.get(e.uid);return '<tr data-fm-uid="'+esc(e.uid)+'" data-fm-name="'+esc(e.name)+'"><td>'+esc(e.name)+'</td><td><small>'+esc(e.title||'')+'</small></td>'+
        Object.keys(ROLES).map(r=>{const on=has?has.includes(r):ROLE_HINTS[r].test(e.title||'');return '<td><label class="fm-check"><input type="checkbox" value="'+r+'"'+(on?' checked':'')+'>'+(has?'':(on?' <small>مقترح</small>':''))+'</label></td>';}).join('')+
        '<td><button type="button" data-fm-grant>حفظ</button></td></tr>';}).join('')+'</tbody></table></div><p class="fm-hint">المقترح مأخوذ من المسمى الوظيفي، ولا يُفعَّل إلا بعد الضغط على «حفظ».</p>';
  }catch(err){box.innerHTML='<p class="fm-hint">'+esc(message(err))+'</p>';}
}
async function grant(row){
  if(busy||mode!=='manager')return;
  const rolesFor=[...row.querySelectorAll('input[type=checkbox]:checked')].map(i=>i.value).filter(r=>ROLES[r]);
  busy=true;status('جارٍ حفظ الصلاحيات…');
  try{
    await fs().doc('formAccess/'+row.dataset.fmUid).set({roles:rolesFor,name:String(row.dataset.fmName||'').slice(0,150),updatedBy:firebase.auth().currentUser.uid,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    for(const s of row.querySelectorAll('small'))if(s.textContent==='مقترح')s.remove();
    status('حُفظت صلاحيات '+row.dataset.fmName+'.');
  }catch(err){status(message(err));}
  finally{busy=false;}
}
function onClick(e){
  const b=e.target.closest('button');if(!b||!host||!host.contains(b))return;
  const d=b.dataset;
  if(d.fmOpen){openForm(d.fmOpen);return;}
  if(d.fmLink){const f=byCode.get(d.fmLink),target=f&&$(f.link);if(target&&mode==='manager'&&!target.hidden){target.click();}else status('يُنفّذ هذا النموذج من «'+(f?f.linkLabel:'')+'» في المنصة، ويُطبع منه بالشكل الرسمي.');return;}
  if(b.hasAttribute('data-fm-home')){view='home';form=null;paint();status('');return;}
  if(b.hasAttribute('data-fm-access')){accessView();return;}
  if(b.hasAttribute('data-fm-grant')){grant(b.closest('tr'));return;}
  if(b.hasAttribute('data-fm-new')){newRecord();return;}
  if(d.fmRecord){const r=records.find(x=>x.id===d.fmRecord);if(r){record={id:r.id,revision:r.revision||0,status:r.status,header:Object.assign({},r.header||{}),rows:(r.rows||[]).map(x=>Object.assign({},x))};for(const s of form.sections)if(!record.rows.some(x=>x.s===s.key)&&record.status!=='final')record.rows.push({s:s.key});view='record';paint();status('');}return;}
  if(b.hasAttribute('data-fm-back')){view='form';record=null;paint();return;}
  if(d.fmAdd){collect();record.rows.push({s:d.fmAdd});paint();return;}
  if(d.fmDel!==undefined){collect();record.rows.splice(Number(d.fmDel),1);paint();return;}
  if(b.hasAttribute('data-fm-save')){save(false);return;}
  if(b.hasAttribute('data-fm-final')){save(true);return;}
  if(b.hasAttribute('data-fm-print')){printRecord();}
}
const style=document.createElement('style');
style.textContent='.fm-page{direction:rtl}.fm-head{background:#fff;border:1px solid #dae5df;border-radius:18px;padding:20px 22px;margin-bottom:14px}.fm-head h2{margin:0 0 4px;font-size:22px;color:#123e36}.fm-head p{margin:0;color:#5b6b66}'+
  '#fmStatus:empty{display:none}#fmStatus{font-weight:600;color:#17624d}.fm-hint{color:#5b6b66}'+
  '.fm-group h3{margin:16px 0 8px;color:#123e36}.fm-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}'+
  '.fm-card{display:grid;gap:4px;text-align:start;font:inherit;padding:12px 14px;border:1px solid #dae5df;border-radius:12px;background:#fff;cursor:pointer;color:inherit}.fm-card:hover,.fm-card:focus-visible{border-color:#17624d;background:#f2f8f5}.fm-card small{color:#5b6b66;direction:rtl}'+
  '.fm-page button{font:inherit;padding:7px 12px;border:1px solid #a5c5ba;border-radius:8px;background:#fff;cursor:pointer;color:inherit}.fm-page .fm-primary{background:#17624d;color:#fff;border-color:#17624d}.fm-page button:disabled{opacity:.55}'+
  '.fm-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0}.fm-bar h3{margin:0;color:#123e36}.fm-bar small{color:#5b6b66}.fm-back{margin-bottom:6px}'+
  '.fm-grid{overflow:auto;background:#fff;border:1px solid #dae5df;border-radius:12px;margin-bottom:8px}.fm-grid table{border-collapse:collapse;width:100%;font-size:14px}.fm-grid th,.fm-grid td{border-bottom:1px solid #e3ece8;padding:6px;text-align:start;vertical-align:middle}.fm-grid thead{background:#e8f2ed}'+
  '.fm-grid input,.fm-grid select{font:inherit;padding:5px 7px;border:1px solid #c9dad3;border-radius:6px;min-width:90px;width:100%;box-sizing:border-box}'+
  '.fm-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;background:#fff;border:1px solid #dae5df;border-radius:12px;padding:12px;margin-bottom:10px}.fm-fields label{display:grid;gap:4px;font-size:14px}.fm-fields input,.fm-fields select{font:inherit;padding:7px 9px;border:1px solid #a5c5ba;border-radius:8px}'+
  '.fm-statement{background:#fff8e6;border:1px solid #f0dca6;border-radius:10px;padding:10px 12px;font-weight:600}.fm-sec h4{margin:12px 0 6px;color:#123e36}.fm-blank{color:#8a9a95;font-size:12px}'+
  '.fm-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.fm-state{padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600}.fm-draft{background:#fff4dc;color:#7a4d00}.fm-final{background:#e8f5e9;color:#17633a}.fm-check{display:flex;gap:4px;align-items:center}';
document.head.append(style);
setInterval(tick,1000);
})(window);
