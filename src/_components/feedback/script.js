document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("page-feedback-form");
  const voteButtons = document.querySelectorAll(".page-feedback-vote");
  const header = document.getElementById("page-feedback-header");
  const label = document.getElementById("page-feedback-label");
  const comment = document.getElementById("page-feedback-comment");
  const clear = document.getElementById("page-feedback-clear");
  const submit = document.getElementById("page-feedback-submit");

  let selectedButton = null;

  clear.addEventListener("click", function (event) {
    event.preventDefault();
    comment.value = "";
    label.textContent = "Was reading this article a good use of your time?";
    voteButtons.forEach((button) => {
      button.classList.remove("button--info");
      button.classList.add("button--secondary");
    });
  });

  submit.addEventListener("click", function (event) {
    event.preventDefault();
    console.log("Soon. Not yet.");
  });

  voteButtons.forEach((button) => {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      const vote = parseInt(button.dataset.vote);
      form.style.display = "block";
      header.style.display = "none";
      submit.disabled = true;

      if (selectedButton) {
        selectedButton.classList.remove("button--info");
        selectedButton.classList.add("button--secondary");
      }

      button.classList.remove("button--secondary");
      button.classList.add("button--info");
      selectedButton = button;

      switch (vote) {
        case 0:
        case -1:
          label.textContent = "Sorry! What could be better about this page?";
          break;
        case 1:
          label.textContent = "Great! What could make this page even better?";
          break;
        default:
          label.textContent = "No idea what " + vote + " is supposed to mean.";
          break;
      }
      comment.focus();
    });
  });
});
